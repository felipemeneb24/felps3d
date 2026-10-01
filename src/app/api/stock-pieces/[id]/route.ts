import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateQuote } from "@/lib/quote";
import { resolveStockPieceInput } from "@/lib/stock-piece-service";
import { toStockPieceDTO } from "@/lib/stock-piece";
import { Prisma } from "@/generated/prisma/client";
import { requireApiAuth } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const pieceId = Number(id);
  if (!Number.isInteger(pieceId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const existing = await prisma.stockPiece.findUnique({ where: { id: pieceId }, include: { items: true } });
  if (!existing) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }

  const body = await request.json();
  const resolved = await resolveStockPieceInput(body, existing.items);
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

  const piece = await prisma.$transaction(async (tx) => {
    // Devolve pro estoque o que a composição antiga tinha abatido (gramas × quantidade
    // antiga) antes de aplicar a nova, senão editar a peça faria o filamento dobrar de conta.
    for (const oldItem of existing.items) {
      if (oldItem.filamentId == null) continue;
      await tx.filament.update({
        where: { id: oldItem.filamentId },
        data: { stockGrams: { increment: Number(oldItem.gramsUsed) * existing.quantity } },
      });
    }

    const updated = await tx.stockPiece.update({
      where: { id: pieceId },
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
          deleteMany: {},
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

    // Abate a nova composição (gramas × quantidade nova).
    for (const item of items) {
      if (item.filamentId == null) continue;
      await tx.filament.update({
        where: { id: item.filamentId },
        data: { stockGrams: { decrement: item.gramsUsed * quantity } },
      });
    }

    return updated;
  });

  return NextResponse.json(toStockPieceDTO(piece));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const pieceId = Number(id);
  if (!Number.isInteger(pieceId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  // Nem toda peça excluída deve devolver filamento pro estoque: às vezes ela
  // estragou na impressão ou foi doada, então quem exclui decide. Por padrão
  // (sem o parâmetro) devolve, pra não quebrar chamadas antigas.
  const restock = request.nextUrl.searchParams.get("restock") !== "false";

  const piece = await prisma.stockPiece.findUnique({ where: { id: pieceId }, include: { items: true } });
  if (!piece) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }

  // Exclui a peça e, se pedido, devolve pro estoque as gramas que tinham sido abatidas por ela.
  await prisma.$transaction(async (tx) => {
    await tx.stockPiece.delete({ where: { id: pieceId } });

    if (!restock) return;

    for (const item of piece.items) {
      if (item.filamentId == null) continue;
      await tx.filament.update({
        where: { id: item.filamentId },
        data: { stockGrams: { increment: Number(item.gramsUsed) * piece.quantity } },
      });
    }
  });

  return new NextResponse(null, { status: 204 });
}
