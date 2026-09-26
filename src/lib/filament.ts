import type { Filament } from "@/generated/prisma/client";

/**
 * Representação de um filamento já pronta para ir para o front-end,
 * com os valores calculados (preço da grama, valor do rolo e valor do
 * estoque atual) e o Decimal do Prisma convertido para number.
 */
export type FilamentDTO = {
  id: number;
  colorName: string;
  material: string | null;
  brand: string | null;
  pricePerKg: number;
  rollWeightG: number;
  stockGrams: number;
  pricePerGram: number;
  rollValue: number;
  stockValue: number;
  createdAt: string;
  updatedAt: string;
};

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function toFilamentDTO(filament: Filament): FilamentDTO {
  const pricePerKg = Number(filament.pricePerKg);
  const stockGrams = Number(filament.stockGrams);
  const pricePerGram = round(pricePerKg / 1000, 6);
  const rollValue = round(pricePerGram * filament.rollWeightG, 2);
  const stockValue = round(pricePerGram * stockGrams, 2);

  return {
    id: filament.id,
    colorName: filament.colorName,
    material: filament.material,
    brand: filament.brand,
    pricePerKg,
    rollWeightG: filament.rollWeightG,
    stockGrams,
    pricePerGram,
    rollValue,
    stockValue,
    createdAt: filament.createdAt.toISOString(),
    updatedAt: filament.updatedAt.toISOString(),
  };
}
