import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateQuote } from "@/lib/quote";
import { resolveStockPieceInput } from "@/lib/stock-piece-service";
import { toStockPieceDTO } from "@/lib/stock-piece";
import { Prisma } from "@/generated/prisma/client";
import { requireApiAuth } from "@/lib/auth/session";

export async function GET() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const pieces = await prisma.stockPiece.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { items: true },
  });

  return NextResponse.json(pieces.map(toStockPieceDTO));
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const resolved = await resolveStockPieceInput(body);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const {
    productName,
    photoDataUrl,
    printTimeHours,
    printCostPerHour,
    extraCost,
    extraCostNote,
    salePrice,
    quantity,
    items,
  } = resolved.data;

  const calc = calculateQuote({ printTimeHours, printCostPerHour, items, extraCost, salePrice });

  // Essas peças já existem fisicamente prontas: abate do estoque o filamento
  // usado em cada unidade (gramas por peça × quantidade).
  const piece = await prisma.$transaction(async (tx) => {
    const created = await tx.stockPiece.create({
      data: {
        productName,
        photoDataUrl,
        printTimeHours: new Prisma.Decimal(printTimeHours.toFixed(2)),
        printCostPerHour: new Prisma.Decimal(printCostPerHour.toFixed(2)),
        printCost: new Prisma.Decimal(calc.printCost.toFixed(2)),
        filamentCost: new Prisma.Decimal(calc.filamentCost.toFixed(2)),
        extraCost: new Prisma.Decimal(calc.extraCost.toFixed(2)),
        extraCostNote,
        totalCost: new Prisma.Decimal(calc.totalCost.toFixed(2)),
        suggestedPrice: new Prisma.Decimal(calc.suggestedPrice.toFixed(2)),
        salePrice: new Prisma.Decimal(calc.salePrice.toFixed(2)),
        quantity,
        items: {
          create: items.map((item, index) => ({
            filamentId: item.filamentId,
            colorName: item.colorName,
            gramsUsed: new Prisma.Decimal(item.gramsUsed.toFixed(2)),
            pricePerGram: new Prisma.Decimal(item.pricePerGram.toFixed(6)),
            lineCost: new Prisma.Decimal(calc.itemsCost[index].toFixed(2)),
          })),
        },
      },
      include: { items: true },
    });

    for (const item of items) {
      if (item.filamentId == null) continue;
      await tx.filament.update({
        where: { id: item.filamentId },
        data: { stockGrams: { decrement: item.gramsUsed * quantity } },
      });
    }

    return created;
  });

  return NextResponse.json(toStockPieceDTO(piece), { status: 201 });
}
