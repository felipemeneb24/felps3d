import { prisma } from "@/lib/prisma";
import { DEFAULT_PRINT_COST_PER_HOUR } from "@/lib/quote";

export type ResolvedQuoteInput = {
  productName: string;
  customerName: string | null;
  customerPhone: string | null;
  printTimeHours: number;
  printCostPerHour: number;
  /** Custo extra opcional, fora impressão e filamento (ex: parafuso, LED, outro material). */
  extraCost: number;
  extraCostNote: string | null;
  /** Preço de venda informado pelo usuário; undefined = usar o valor sugerido (2x custo). */
  salePrice: number | undefined;
  items: { filamentId: number; colorName: string; gramsUsed: number; pricePerGram: number }[];
};

type RawItem = { filamentId: number; gramsUsed: number };

/**
 * Valida o corpo recebido para criar/editar um orçamento e resolve cada item
 * de filamento contra o cadastro (preço/g atual). Compartilhado entre POST e PUT.
 */
export async function resolveQuoteInput(
  body: Record<string, unknown>
): Promise<{ data: ResolvedQuoteInput } | { error: string }> {
  const productName = String(body.productName ?? "").trim();
  const customerNameRaw = String(body.customerName ?? "").trim();
  const customerPhoneRaw = String(body.customerPhone ?? "").trim();
  const customerName = customerNameRaw || null;
  const customerPhone = customerPhoneRaw || null;
  const printTimeHours = Number(body.printTimeHours);
  const printCostPerHour = Number(body.printCostPerHour ?? DEFAULT_PRINT_COST_PER_HOUR);
  const extraCostRaw = body.extraCost != null ? Number(body.extraCost) : 0;
  const extraCost = Number.isFinite(extraCostRaw) && extraCostRaw > 0 ? extraCostRaw : 0;
  const extraCostNoteRaw = String(body.extraCostNote ?? "").trim();
  const extraCostNote = extraCost > 0 && extraCostNoteRaw ? extraCostNoteRaw : null;
  const salePriceRaw = body.salePrice != null ? Number(body.salePrice) : undefined;
  const salePrice = salePriceRaw != null && Number.isFinite(salePriceRaw) && salePriceRaw > 0 ? salePriceRaw : undefined;
  const rawItems: RawItem[] = Array.isArray(body.items) ? (body.items as RawItem[]) : [];

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
  if (rawItems.length === 0) {
    return { error: "Adicione ao menos um filamento usado na peça." };
  }

  const filamentIds = rawItems.map((item) => Number(item.filamentId));
  const filaments = await prisma.filament.findMany({ where: { id: { in: filamentIds } } });
  const filamentById = new Map(filaments.map((f) => [f.id, f]));

  const items: ResolvedQuoteInput["items"] = [];
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
      customerName,
      customerPhone,
      printTimeHours,
      printCostPerHour,
      extraCost,
      extraCostNote,
      salePrice,
      items,
    },
  };
}
