import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toOrderDTO, ORDER_STATUS_VALUES } from "@/lib/order";
import { round, SHOPEE_COMMISSION_RATE, SHOPEE_FIXED_FEE } from "@/lib/quote";
import type { Prisma } from "@/generated/prisma/client";
import { requireApiAuth } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const body = await request.json();
  const data: Prisma.OrderUpdateInput = {};

  if (body.status !== undefined) {
    if (!ORDER_STATUS_VALUES.includes(body.status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.isPaid !== undefined) {
    if (typeof body.isPaid !== "boolean") {
      return NextResponse.json({ error: "Valor de pagamento inválido." }, { status: 400 });
    }
    data.isPaid = body.isPaid;
  }
  if (body.salePrice !== undefined) {
    const salePrice = Number(body.salePrice);
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      return NextResponse.json({ error: "Valor de venda inválido." }, { status: 400 });
    }

    // Só dá pra ajustar o valor de venda em pedidos de venda direta: na Shopee o preço
    // é o que foi de fato cobrado por lá, então mexer aqui destoaria da taxa já cobrada.
    const currentOrder = await prisma.order.findUnique({ where: { id: orderId } });
    if (!currentOrder) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (currentOrder.saleChannel !== "DIRETA") {
      return NextResponse.json(
        { error: "Só é possível ajustar o valor de venda em pedidos de venda direta." },
        { status: 400 }
      );
    }

    const roundedSalePrice = round(salePrice);
    data.salePrice = roundedSalePrice;
    // Mantém shopeeFee/shopeeNet coerentes com o novo valor pra seção "Shopee"
    // (referência/what-if) do detalhe do pedido não ficar com números velhos.
    data.shopeeFee = round(roundedSalePrice * SHOPEE_COMMISSION_RATE + SHOPEE_FIXED_FEE);
    data.shopeeNet = round(roundedSalePrice - Number(data.shopeeFee));
  }

  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data,
      include: { items: true },
    });
    return NextResponse.json(toOrderDTO(order));
  } catch {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  // Exclui o pedido e devolve pro estoque as gramas que tinham sido abatidas ao fechá-lo.
  await prisma.$transaction(async (tx) => {
    await tx.order.delete({ where: { id: orderId } });

    for (const item of order.items) {
      if (item.filamentId == null) continue;
      await tx.filament.update({
        where: { id: item.filamentId },
        data: { stockGrams: { increment: item.gramsUsed } },
      });
    }
  });

  return new NextResponse(null, { status: 204 });
}
