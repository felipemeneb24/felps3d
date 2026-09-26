import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toFilamentDTO } from "@/lib/filament";
import { Prisma } from "@/generated/prisma/client";
import { requireApiAuth } from "@/lib/auth/session";

export async function GET() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const filaments = await prisma.filament.findMany({
    orderBy: [{ colorName: "asc" }],
  });

  return NextResponse.json(filaments.map(toFilamentDTO));
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();

  const colorName = String(body.colorName ?? "").trim();
  const material = body.material ? String(body.material).trim() : null;
  const brand = body.brand ? String(body.brand).trim() : null;
  const pricePerKg = Number(body.pricePerKg);
  const rollWeightG = Number(body.rollWeightG);
  const stockRolls = body.stockRolls != null ? Number(body.stockRolls) : 0;
  const stockGrams = Number.isFinite(stockRolls) ? Math.round(stockRolls * rollWeightG) : 0;

  if (!colorName) {
    return NextResponse.json(
      { error: "O nome da cor é obrigatório." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
    return NextResponse.json(
      { error: "Informe um valor por quilo válido." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(rollWeightG) || rollWeightG <= 0) {
    return NextResponse.json(
      { error: "Informe um peso de rolo válido (em gramas)." },
      { status: 400 }
    );
  }

  const filament = await prisma.filament.create({
    data: {
      colorName,
      material,
      brand,
      pricePerKg: new Prisma.Decimal(pricePerKg.toFixed(2)),
      rollWeightG,
      stockGrams,
    },
  });

  return NextResponse.json(toFilamentDTO(filament), { status: 201 });
}
