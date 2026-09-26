import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/customer";
import { toStockPieceDTO } from "@/lib/stock-piece";
import { round, SHOPEE_COMMISSION_RATE, SHOPEE_FIXED_FEE } from "@/lib/quote";
import { SALE_CHANNEL_VALUES } from "@/lib/order";
import { requireApiAuth } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

const INSTANT_SALE_ADDRESS = "Venda direta em estoque (retirada na hora, sem entrega).";

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const pieceId = Number(id);
  if (!Number.isInteger(pieceId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const saleChannel = SALE_CHANNEL_VALUES.includes(body.saleChannel) ? body.saleChannel : "DIRETA";
  // Venda Shopee de uma peça de estoque segue o mesmo fluxo de fechar um orçamento
  // pra Shopee: pede nome, endereço e prazo de entrega, e o pedido nasce pendente
  // (ainda precisa ser enviado) em vez de já finalizado como a venda direta na feira.
  const isShopee = saleChannel === "SHOPEE";
  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const deliveryAddress = String(body.deliveryAddress ?? "").trim();
  const deliveryDeadlineRaw = String(body.deliveryDeadline ?? "").trim();
  // Quantas unidades idênticas estão sendo vendidas de uma vez (padrão 1).
  const quantity = body.quantity === undefined ? 1 : Number(body.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Informe uma quantidade válida (número inteiro maior que zero)." }, { status: 400 });
  }

  if (customerPhone && normalizePhone(customerPhone).length < 8) {
    return NextResponse.json({ error: "Informe um telefone válido (ou deixe em branco)." }, { status: 400 });
  }

  let deliveryDeadline = new Date();
  // Preço vendido na Shopee pode divergir do cadastrado na peça — deixa informar.
  let shopeeSalePrice: number | null = null;
  if (isShopee) {
    if (!customerName) {
      return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
    }
    if (!deliveryAddress) {
      return NextResponse.json({ error: "Informe o endereço de entrega." }, { status: 400 });
    }
    const parsedDeadline = new Date(deliveryDeadlineRaw);
    if (!deliveryDeadlineRaw || Number.isNaN(parsedDeadline.getTime())) {
      return NextResponse.json({ error: "Informe um prazo de entrega válido." }, { status: 400 });
    }
    deliveryDeadline = parsedDeadline;

    shopeeSalePrice = Number(body.salePrice);
    if (!Number.isFinite(shopeeSalePrice) || shopeeSalePrice <= 0) {
      return NextResponse.json({ error: "Informe um valor de venda válido." }, { status: 400 });
    }
  }

  const piece = await prisma.stockPiece.findUnique({ where: { id: pieceId }, include: { items: true } });
  if (!piece) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }
  if (piece.quantity <= 0) {
    return NextResponse.json({ error: "Não tem mais unidades dessa peça em estoque." }, { status: 400 });
  }

  if (quantity > piece.quantity) {
    return NextResponse.json(
      { error: `Quantidade indisponível: só tem ${piece.quantity} un. dessa peça em estoque.` },
      { status: 400 }
    );
  }

  // O pedido guarda o TOTAL das unidades vendidas (preço, custos e gramas vezes a
  // quantidade), pra que os somatórios de vendas/lucro continuem batendo.
  // A taxa da Shopee é cobrada por unidade (comissão + fixo de cada item).
  const unitPrice = shopeeSalePrice ?? Number(piece.salePrice);
  const salePrice = round(unitPrice * quantity);
  const shopeeFee = round((unitPrice * SHOPEE_COMMISSION_RATE + SHOPEE_FIXED_FEE) * quantity);
  const shopeeNet = round(salePrice - shopeeFee);
  const times = (value: unknown) => round(Number(value) * quantity);

  // Dá baixa na peça e registra a venda como um pedido — venda direta já nasce
  // finalizada e paga (retirada na hora), venda Shopee nasce pendente igual um
  // pedido normal fechado por lá, e segue os mesmos status de produção/envio.
  // Não abate filamento de novo (já foi abatido quando a peça foi feita) e não linka
  // os itens a um filamento de verdade (fica só de referência visual no pedido).
  const updatedPiece = await prisma.$transaction(async (tx) => {
    // Baixa condicional: só abate se ainda houver unidades suficientes no momento da
    // gravação (evita estoque negativo se duas vendas acontecerem ao mesmo tempo).
    const { count } = await tx.stockPiece.updateMany({
      where: { id: pieceId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (count === 0) return null;

    await tx.order.create({
      data: {
        productName: quantity > 1 ? `${piece.productName} (${quantity} un.)` : piece.productName,
        printTimeHours: times(piece.printTimeHours),
        printCostPerHour: piece.printCostPerHour,
        printCost: times(piece.printCost),
        filamentCost: times(piece.filamentCost),
        extraCost: times(piece.extraCost),
        extraCostNote: piece.extraCostNote,
        totalCost: times(piece.totalCost),
        suggestedPrice: times(piece.suggestedPrice),
        salePrice,
        shopeeFee,
        shopeeNet,
        customerName: isShopee ? customerName : customerName || "Cliente não identificado",
        customerPhone: customerPhone || null,
        deliveryAddress: isShopee ? deliveryAddress : INSTANT_SALE_ADDRESS,
        deliveryDeadline,
        status: isShopee ? "PENDENTE" : "FINALIZADO",
        saleChannel,
        isPaid: !isShopee,
        items: {
          create: piece.items.map((item) => ({
            filamentId: null,
            colorName: item.colorName,
            // OrderItem.gramsUsed é Int — aqui é só registro histórico do pedido
            // (o filamento em si já foi abatido quando a peça foi feita).
            gramsUsed: Math.round(Number(item.gramsUsed) * quantity),
            pricePerGram: item.pricePerGram,
            lineCost: times(item.lineCost),
          })),
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

    return tx.stockPiece.findUniqueOrThrow({ where: { id: pieceId }, include: { items: true } });
  });

  if (!updatedPiece) {
    return NextResponse.json(
      { error: "Quantidade indisponível: o estoque dessa peça mudou, confira e tente de novo." },
      { status: 409 }
    );
  }

  return NextResponse.json(toStockPieceDTO(updatedPiece));
}
