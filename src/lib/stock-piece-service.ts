import { prisma } from "@/lib/prisma";
import { DEFAULT_PRINT_COST_PER_HOUR } from "@/lib/quote";

// ~4.3MB de imagem original, já contando o overhead de ~33% do base64.
const MAX_PHOTO_DATA_URL_LENGTH = 6_000_000;

export type ResolvedStockPieceInput = {
  productName: string;
  photoDataUrl: string | null;
  printTimeHours: number;
  printCostPerHour: number;
  /** Custo extra opcional, fora impressão e filamento (ex: parafuso, LED, outro material). */
  extraCost: number;
  extraCostNote: string | null;
  /** Preço de venda informado pelo usuário; undefined = usar o valor sugerido (2x custo). */
  salePrice: number | undefined;
  quantity: number;
  items: { filamentId: number; colorName: string; gramsUsed: number; pricePerGram: number }[];
};

type RawItem = { filamentId: number; gramsUsed: number };

/**
 * Valida o corpo recebido para criar/editar uma peça em estoque e resolve cada item
 * de filamento contra o cadastro (preço/g atual). Compartilhado entre POST e PUT.
 */
export async function resolveStockPieceInput(
  body: Record<string, unknown>
): Promise<{ data: ResolvedStockPieceInput } | { error: string }> {
  const productName = String(body.productName ?? "").trim();
  const printTimeHours = Number(body.printTimeHours);
  const printCostPerHour = Number(body.printCostPerHour ?? DEFAULT_PRINT_COST_PER_HOUR);
  const extraCostRaw = body.extraCost != null ? Number(body.extraCost) : 0;
  const extraCost = Number.isFinite(extraCostRaw) && extraCostRaw > 0 ? extraCostRaw : 0;
  const extraCostNoteRaw = String(body.extraCostNote ?? "").trim();
  const extraCostNote = extraCost > 0 && extraCostNoteRaw ? extraCostNoteRaw : null;
  const salePriceRaw = body.salePrice != null ? Number(body.salePrice) : undefined;
  const salePrice = salePriceRaw != null && Number.isFinite(salePriceRaw) && salePriceRaw > 0 ? salePriceRaw : undefined;
  const quantity = Number(body.quantity ?? 1);
  const rawItems: RawItem[] = Array.isArray(body.items) ? (body.items as RawItem[]) : [];
  const photoDataUrlRaw = typeof body.photoDataUrl === "string" ? body.photoDataUrl.trim() : "";
  const photoDataUrl = photoDataUrlRaw || null;

  if (!productName) return { error: "Informe o nome do produto." };
  if (!Number.isFinite(printTimeHours) || printTimeHours <= 0) {
    return { error: "Informe um tempo de impressão válido." };
  }
  if (!Number.isFinite(printCostPerHour) || printCostPerHour < 0) {
    return { error: "Informe um custo de impressão da máquina válido." };
  }
  if (body.extraCost != null && !Number.isFinite(Number(body.extraCost))) {
    return { error: "Informe um custo adicional válido." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Informe uma quantidade válida (pelo menos 1)." };
  }
  if (rawItems.length === 0) {
    return { error: "Adicione ao menos um filamento usado na peça." };
  }
  if (photoDataUrl && !photoDataUrl.startsWith("data:image/")) {
    return { error: "Foto inválida." };
  }
  if (photoDataUrl && photoDataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
    return { error: "Foto muito grande. Use uma imagem menor (até uns 4MB)." };
  }

  const filamentIds = rawItems.map((item) => Number(item.filamentId));
  const filaments = await prisma.filament.findMany({ where: { id: { in: filamentIds } } });
  const filamentById = new Map(filaments.map((f) => [f.id, f]));

  const items: ResolvedStockPieceInput["items"] = [];
  for (const raw of rawItems) {
    const filamentId = Number(raw.filamentId);
    const gramsUsed = Number(raw.gramsUsed);
    const filament = filamentById.get(filamentId);

    if (!filament) {
      return { error: "Filamento inválido em um dos itens." };
    }
    if (!Number.isFinite(gramsUsed) || gramsUsed <= 0) {
      return { error: `Informe uma quantidade de gramas válida para "${filament.colorName}".` };
    }

    items.push({
      filamentId,
      colorName: filament.colorName,
      gramsUsed,
      pricePerGram: Number(filament.pricePerKg) / 1000,
    });
  }

  return {
    data: {
      productName,
      photoDataUrl,
      printTimeHours,
      printCostPerHour,
      extraCost,
      extraCostNote,
      salePrice,
      quantity,
      items,
    },
  };
}
