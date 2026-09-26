import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toOrderDTO, SALE_CHANNEL_VALUES } from "@/lib/order";
import { normalizePhone } from "@/lib/customer";
import { requireApiAuth } from "@/lib/auth/session";

export async function GET() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const orders = await prisma.order.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { items: true },
  });

  return NextResponse.json(orders.map(toOrderDTO));
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();

  const quoteId = Number(body.quoteId);
  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const deliveryAddress = String(body.deliveryAddress ?? "").trim();
  const deliveryDeadlineRaw = String(body.deliveryDeadline ?? "").trim();
  const saleChannel = SALE_CHANNEL_VALUES.includes(body.saleChannel) ? body.saleChannel : "DIRETA";

  if (!Number.isInteger(quoteId)) {
    return NextResponse.json({ error: "Orçamento inválido." }, { status: 400 });
  }
  if (!customerName) {
    return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
  }
  // Venda Shopee: o comprador é da Shopee, então não temos (nem exigimos) o telefone dele.
  const isShopee = saleChannel === "SHOPEE";
  if (!isShopee && !customerPhone) {
    return NextResponse.json({ error: "Informe o telefone do cliente." }, { status: 400 });
  }
  const phoneDigits = normalizePhone(customerPhone);
  if (!isShopee && phoneDigits.length < 8) {
    return NextResponse.json({ error: "Informe um telefone válido." }, { status: 400 });
  }
  if (!deliveryAddress) {
    return NextResponse.json({ error: "Informe o endereço de entrega." }, { status: 400 });
  }
  const deliveryDeadline = new Date(deliveryDeadlineRaw);
  if (!deliveryDeadlineRaw || Number.isNaN(deliveryDeadline.getTime())) {
    return NextResponse.json({ error: "Informe um prazo de entrega válido." }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { items: true } });
  if (!quote) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  // Fecha o pedido copiando os dados do orçamento e apaga o orçamento em seguida —
  // a partir daqui o pedido é a fonte da verdade, o orçamento deixou de existir.
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        productName: quote.productName,
        printTimeHours: quote.printTimeHours,
        printCostPerHour: quote.printCostPerHour,
        printCost: quote.printCost,
        filamentCost: quote.filamentCost,
        extraCost: quote.extraCost,
        extraCostNote: quote.extraCostNote,
        totalCost: quote.totalCost,
        suggestedPrice: quote.suggestedPrice,
        salePrice: quote.salePrice,
        shopeeFee: quote.shopeeFee,
        shopeeNet: quote.shopeeNet,
        customerName,
        customerPhone: customerPhone || null,
        deliveryAddress,
        deliveryDeadline,
        saleChannel,
        items: {
          create: quote.items.map((item) => ({
            filamentId: item.filamentId,
            colorName: item.colorName,
            gramsUsed: item.gramsUsed,
            pricePerGram: item.pricePerGram,
            lineCost: item.lineCost,
          })),
        },
      },
      include: { items: true },
    });

    await tx.quote.delete({ where: { id: quoteId } });

    // Reconhece o cliente pelo telefone: se já existe, mantém os dados em dia;
    // se não existe, cadastra automaticamente. Vendas Shopee nunca cadastram —
    // o comprador é da Shopee, não é um cliente nosso com dados reais.
    if (!isShopee) {
      await tx.customer.upsert({
        where: { phoneDigits },
        update: { name: customerName, phone: customerPhone },
        create: { name: customerName, phone: customerPhone, phoneDigits },
      });
    }

    // Abate do estoque as gramas usadas em cada filamento da peça.
    for (const item of quote.items) {
      if (item.filamentId == null) continue;
      await tx.filament.update({
        where: { id: item.filamentId },
        data: { stockGrams: { decrement: item.gramsUsed } },
      });
    }

    return created;
  });

  return NextResponse.json(toOrderDTO(order), { status: 201 });
}
