import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/customer";
import { toStockPieceDTO, type StockPieceDTO } from "@/lib/stock-piece";
import { round, SHOPEE_COMMISSION_RATE, SHOPEE_FIXED_FEE } from "@/lib/quote";
import { SALE_CHANNEL_VALUES } from "@/lib/order";
import type { SaleChannel } from "@/generated/prisma/client";

const INSTANT_SALE_ADDRESS = "Venda direta em estoque (retirada na hora, sem entrega).";

type SaleLine = {
  pieceId: number;
  quantity: number;
  /** Preço por unidade informado na venda Shopee (pode divergir do cadastrado na peça). */
  unitPrice: number | null;
};

type SaleResult = { pieces: StockPieceDTO[] } | { error: string; status: number };

// Erro lançado dentro da transação pra desfazer tudo quando o estoque mudou no meio.
class StockChangedError extends Error {
  constructor(public productName: string) {
    super("stock changed");
  }
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Registra a venda de uma ou mais peças de estoque como UM pedido só (venda avulsa
 * de um modelo ou carrinho com vários). O pedido guarda o TOTAL de tudo que foi
 * vendido (preço, custos e gramas somados), pra que os somatórios de vendas/lucro
 * continuem batendo. Toda venda de estoque (direta ou Shopee) nasce pendente e
 * sem pagar — o status e o pagamento são marcados depois, na lista de pedidos.
 *
 * Não abate filamento de novo (já foi abatido quando a peça foi feita) e não linka
 * os itens a um filamento de verdade (ficam só de referência visual no pedido).
 */
export async function sellStockPieces(body: Record<string, unknown>, rawLines: unknown[]): Promise<SaleResult> {
  const saleChannel: SaleChannel = SALE_CHANNEL_VALUES.includes(body.saleChannel as SaleChannel)
    ? (body.saleChannel as SaleChannel)
    : "DIRETA";
  const isShopee = saleChannel === "SHOPEE";
  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const deliveryAddress = String(body.deliveryAddress ?? "").trim();
  const deliveryDeadlineRaw = String(body.deliveryDeadline ?? "").trim();

  if (rawLines.length === 0) {
    return { error: "Adicione ao menos uma peça na venda.", status: 400 };
  }

  // Junta linhas repetidas da mesma peça numa só (somando a quantidade).
  const linesById = new Map<number, SaleLine>();
  for (const raw of rawLines as Record<string, unknown>[]) {
    const pieceId = Number(raw?.pieceId);
    const quantity = raw?.quantity === undefined ? 1 : Number(raw.quantity);
    if (!Number.isInteger(pieceId)) {
      return { error: "Peça inválida na venda.", status: 400 };
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: "Informe uma quantidade válida (número inteiro maior que zero).", status: 400 };
    }
    let unitPrice: number | null = null;
    if (isShopee) {
      unitPrice = Number(raw.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return { error: "Informe um valor de venda válido.", status: 400 };
      }
    }
    const existing = linesById.get(pieceId);
    linesById.set(pieceId, {
      pieceId,
      quantity: (existing?.quantity ?? 0) + quantity,
      unitPrice: unitPrice ?? existing?.unitPrice ?? null,
    });
  }
  const lines = [...linesById.values()];

  if (customerPhone && normalizePhone(customerPhone).length < 8) {
    return { error: "Informe um telefone válido (ou deixe em branco).", status: 400 };
  }

  let deliveryDeadline = new Date();
  if (isShopee) {
    if (!customerName) return { error: "Informe o nome do cliente.", status: 400 };
    if (!deliveryAddress) return { error: "Informe o endereço de entrega.", status: 400 };
    const parsedDeadline = new Date(deliveryDeadlineRaw);
    if (!deliveryDeadlineRaw || Number.isNaN(parsedDeadline.getTime())) {
      return { error: "Informe um prazo de entrega válido.", status: 400 };
    }
    deliveryDeadline = parsedDeadline;
  }

  const pieces = await prisma.stockPiece.findMany({
    where: { id: { in: lines.map((l) => l.pieceId) } },
    include: { items: true },
  });
  const pieceById = new Map(pieces.map((p) => [p.id, p]));

  for (const line of lines) {
    const piece = pieceById.get(line.pieceId);
    if (!piece) return { error: "Peça não encontrada.", status: 404 };
    if (piece.quantity <= 0) {
      return { error: `Não tem mais unidades de "${piece.productName}" em estoque.`, status: 400 };
    }
    if (line.quantity > piece.quantity) {
      return {
        error: `Quantidade indisponível: só tem ${piece.quantity} un. de "${piece.productName}" em estoque.`,
        status: 400,
      };
    }
  }

  const sold = lines.map((line) => ({ line, piece: pieceById.get(line.pieceId)! }));
  const isCart = sold.length > 1;

  // Soma de um campo da peça vezes a quantidade vendida, em todas as linhas.
  const sum = (pick: (p: (typeof sold)[number]["piece"]) => unknown) =>
    round(sold.reduce((acc, { line, piece }) => acc + Number(pick(piece)) * line.quantity, 0));

  // A taxa da Shopee é cobrada por unidade (comissão + fixo de cada item).
  const unitPriceOf = ({ line, piece }: (typeof sold)[number]) => line.unitPrice ?? Number(piece.salePrice);
  const salePrice = round(sold.reduce((acc, s) => acc + unitPriceOf(s) * s.line.quantity, 0));
  const shopeeFee = round(
    sold.reduce(
      (acc, s) => acc + (unitPriceOf(s) * SHOPEE_COMMISSION_RATE + SHOPEE_FIXED_FEE) * s.line.quantity,
      0
    )
  );
  const printTimeHours = sum((p) => p.printTimeHours);
  const printCost = sum((p) => p.printCost);

  const productName = isCart
    ? truncate(`Carrinho: ${sold.map(({ line, piece }) => `${line.quantity}x ${piece.productName}`).join(" + ")}`, 150)
    : sold[0].line.quantity > 1
      ? `${sold[0].piece.productName} (${sold[0].line.quantity} un.)`
      : sold[0].piece.productName;

  const notes = [...new Set(sold.map(({ piece }) => piece.extraCostNote).filter((n): n is string => Boolean(n)))];
  const extraCostNote = notes.length ? truncate(notes.join("; "), 150) : null;

  try {
    const updatedIds = await prisma.$transaction(async (tx) => {
      // Baixa condicional: só abate se ainda houver unidades suficientes no momento da
      // gravação (evita estoque negativo se duas vendas acontecerem ao mesmo tempo).
      // Se qualquer peça do carrinho falhar, a venda inteira é desfeita.
      for (const { line, piece } of sold) {
        const { count } = await tx.stockPiece.updateMany({
          where: { id: line.pieceId, quantity: { gte: line.quantity } },
          data: { quantity: { decrement: line.quantity } },
        });
        if (count === 0) throw new StockChangedError(piece.productName);
      }

      await tx.order.create({
        data: {
          productName,
          printTimeHours,
          // Num carrinho cada peça pode ter um custo/hora diferente — guarda a média
          // efetiva (custo de impressão total / horas totais).
          printCostPerHour:
            isCart && printTimeHours > 0 ? round(printCost / printTimeHours) : sold[0].piece.printCostPerHour,
          printCost,
          filamentCost: sum((p) => p.filamentCost),
          extraCost: sum((p) => p.extraCost),
          extraCostNote,
          totalCost: sum((p) => p.totalCost),
          suggestedPrice: sum((p) => p.suggestedPrice),
          salePrice,
          shopeeFee,
          shopeeNet: round(salePrice - shopeeFee),
          customerName: isShopee ? customerName : customerName || "Cliente não identificado",
          customerPhone: customerPhone || null,
          deliveryAddress: isShopee ? deliveryAddress : INSTANT_SALE_ADDRESS,
          deliveryDeadline,
          status: "PENDENTE",
          saleChannel,
          isPaid: false,
          items: {
            create: sold.flatMap(({ line, piece }) =>
              piece.items.map((item) => ({
                filamentId: null,
                // No carrinho a cor leva o nome da peça junto, pra saber de qual modelo é.
                colorName: isCart ? truncate(`${piece.productName} · ${item.colorName}`, 100) : item.colorName,
                // OrderItem.gramsUsed é Int — aqui é só registro histórico do pedido
                // (o filamento em si já foi abatido quando a peça foi feita).
                gramsUsed: Math.round(Number(item.gramsUsed) * line.quantity),
                pricePerGram: item.pricePerGram,
                lineCost: round(Number(item.lineCost) * line.quantity),
              }))
            ),
          },
        },
      });

      // Só cadastra/atualiza o cliente se tiver nome E telefone — Shopee nunca cadastra
      // (comprador é da Shopee, não temos telefone real dele).
      if (!isShopee && customerName && customerPhone) {
        const phoneDigits = normalizePhone(customerPhone);
        await tx.customer.upsert({
          where: { phoneDigits },
          update: { name: customerName, phone: customerPhone },
          create: { name: customerName, phone: customerPhone, phoneDigits },
        });
      }

      return sold.map(({ line }) => line.pieceId);
    });

    const updated = await prisma.stockPiece.findMany({
      where: { id: { in: updatedIds } },
      include: { items: true },
    });
    return { pieces: updated.map(toStockPieceDTO) };
  } catch (err) {
    if (err instanceof StockChangedError) {
      return {
        error: `Quantidade indisponível: o estoque de "${err.productName}" mudou, confira e tente de novo.`,
        status: 409,
      };
    }
    throw err;
  }
}
