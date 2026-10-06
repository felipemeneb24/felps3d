import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateQuote, toQuoteDTO } from "@/lib/quote";
import { resolveQuoteInput } from "@/lib/quote-service";
import { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const quoteId = Number(id);
  if (!Number.isInteger(quoteId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const body = await request.json();
  const resolved = await resolveQuoteInput(body);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const {
    productName,
    customerName,
    customerPhone,
    printTimeHours,
    printCostPerHour,
    extraCost,
    extraCostNote,
    salePrice,
    items,
  } = resolved.data;

  const calc = calculateQuote({ printTimeHours, printCostPerHour, items, extraCost, salePrice });

  try {
    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        productName,
        customerName,
        customerPhone,
        printTimeHours: new Prisma.Decimal(printTimeHours.toFixed(2)),
        printCostPerHour: new Prisma.Decimal(printCostPerHour.toFixed(2)),
        printCost: new Prisma.Decimal(calc.printCost.toFixed(2)),
        filamentCost: new Prisma.Decimal(calc.filamentCost.toFixed(2)),
        extraCost: new Prisma.Decimal(calc.extraCost.toFixed(2)),
        extraCostNote,
        totalCost: new Prisma.Decimal(calc.totalCost.toFixed(2)),
        suggestedPrice: new Prisma.Decimal(calc.suggestedPrice.toFixed(2)),
        salePrice: new Prisma.Decimal(calc.salePrice.toFixed(2)),
        shopeeFee: new Prisma.Decimal(calc.shopeeFee.toFixed(2)),
        shopeeNet: new Prisma.Decimal(calc.shopeeNet.toFixed(2)),
        items: {
          deleteMany: {},
          create: items.map((item, index) => ({
            filamentId: item.filamentId,
            colorName: item.colorName,
            gramsUsed: item.gramsUsed,
            pricePerGram: new Prisma.Decimal(item.pricePerGram.toFixed(6)),
            lineCost: new Prisma.Decimal(calc.itemsCost[index].toFixed(2)),
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(toQuoteDTO(quote));
  } catch {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const quoteId = Number(id);
  if (!Number.isInteger(quoteId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    await prisma.quote.delete({ where: { id: quoteId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }
}
