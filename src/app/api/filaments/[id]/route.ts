import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toFilamentDTO } from "@/lib/filament";
import { Prisma } from "@/generated/prisma/client";
import { requireApiAuth } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const filamentId = Number(id);
  if (!Number.isInteger(filamentId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const body = await request.json();
  const data: Prisma.FilamentUpdateInput = {};

  if (body.colorName != null) data.colorName = String(body.colorName).trim();
  if (body.material !== undefined)
    data.material = body.material ? String(body.material).trim() : null;
  if (body.brand !== undefined)
    data.brand = body.brand ? String(body.brand).trim() : null;
  if (body.pricePerKg != null) {
    const pricePerKg = Number(body.pricePerKg);
    if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
      return NextResponse.json(
        { error: "Informe um valor por quilo válido." },
        { status: 400 }
      );
    }
    data.pricePerKg = new Prisma.Decimal(pricePerKg.toFixed(2));
  }
  if (body.rollWeightG != null) {
    const rollWeightG = Number(body.rollWeightG);
    if (!Number.isInteger(rollWeightG) || rollWeightG <= 0) {
      return NextResponse.json(
        { error: "Informe um peso de rolo válido (em gramas)." },
        { status: 400 }
      );
    }
    data.rollWeightG = rollWeightG;
  }
  if (body.stockGrams != null) {
    const stockGrams = Number(body.stockGrams);
    if (Number.isFinite(stockGrams)) data.stockGrams = Math.round(stockGrams);
  }
  if (body.addGrams != null) {
    const addGrams = Number(body.addGrams);
    if (!Number.isFinite(addGrams) || addGrams <= 0) {
      return NextResponse.json({ error: "Informe uma quantidade de gramas válida." }, { status: 400 });
    }
    data.stockGrams = { increment: Math.round(addGrams) };
  }

  try {
    const filament = await prisma.filament.update({
      where: { id: filamentId },
      data,
    });
    return NextResponse.json(toFilamentDTO(filament));
  } catch {
    return NextResponse.json(
      { error: "Filamento não encontrado." },
      { status: 404 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const filamentId = Number(id);
  if (!Number.isInteger(filamentId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    await prisma.filament.delete({ where: { id: filamentId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Filamento não encontrado." },
      { status: 404 }
    );
  }
}
