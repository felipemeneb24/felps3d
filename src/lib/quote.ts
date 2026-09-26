import type { Quote, QuoteItem } from "@/generated/prisma/client";

// Custo padrão de impressão por hora (R$). Editável por orçamento no formulário.
export const DEFAULT_PRINT_COST_PER_HOUR = 1;

// Regra da Shopee para produtos até R$79: 20% de comissão + R$4,00 fixo.
export const SHOPEE_COMMISSION_RATE = 0.2;
export const SHOPEE_FIXED_FEE = 4;
export const SHOPEE_TIER_LIMIT = 79;

export function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type QuoteItemInput = {
  filamentId: number;
  gramsUsed: number;
};

export type QuoteCalcInput = {
  printTimeHours: number;
  printCostPerHour: number;
  items: { colorName: string; gramsUsed: number; pricePerGram: number }[];
  /** Custo extra opcional, fora impressão e filamento (ex: parafuso, LED, tinta). */
  extraCost?: number;
  /** Preço de venda, se você quiser cobrar diferente do valor sugerido (2x o custo). */
  salePrice?: number;
};

export type QuoteCalcResult = {
  printCost: number;
  filamentCost: number;
  extraCost: number;
  totalCost: number;
  /** Valor de referência = totalCost * 2. */
  suggestedPrice: number;
  /** Preço de venda de fato usado nos cálculos da Shopee (= suggestedPrice se não for informado). */
  salePrice: number;
  shopeeFee: number;
  shopeeNet: number;
  /** Lucro real vendendo na Shopee: já descontando a taxa da Shopee E o custo de produção. */
  shopeeProfit: number;
  itemsCost: number[];
};

/** Calcula todos os valores de um orçamento/pedido a partir das entradas brutas. */
export function calculateQuote(input: QuoteCalcInput): QuoteCalcResult {
  const printCost = round(input.printTimeHours * input.printCostPerHour);
  const itemsCost = input.items.map((item) => round(item.gramsUsed * item.pricePerGram));
  const filamentCost = round(itemsCost.reduce((sum, cost) => sum + cost, 0));
  const extraCost =
    input.extraCost != null && Number.isFinite(input.extraCost) && input.extraCost > 0
      ? round(input.extraCost)
      : 0;
  const totalCost = round(printCost + filamentCost + extraCost);
  const suggestedPrice = round(totalCost * 2);
  const salePrice =
    input.salePrice != null && Number.isFinite(input.salePrice) && input.salePrice > 0
      ? round(input.salePrice)
      : suggestedPrice;
  const shopeeFee = round(salePrice * SHOPEE_COMMISSION_RATE + SHOPEE_FIXED_FEE);
  const shopeeNet = round(salePrice - shopeeFee);
  const shopeeProfit = round(shopeeNet - totalCost);

  return {
    printCost,
    filamentCost,
    extraCost,
    totalCost,
    suggestedPrice,
    salePrice,
    shopeeFee,
    shopeeNet,
    shopeeProfit,
    itemsCost,
  };
}

export type QuoteItemDTO = {
  id: number;
  filamentId: number | null;
  colorName: string;
  gramsUsed: number;
  pricePerGram: number;
  lineCost: number;
};

export type QuoteDTO = {
  id: number;
  productName: string;
  customerName: string | null;
  customerPhone: string | null;
  printTimeHours: number;
  printCostPerHour: number;
  printCost: number;
  filamentCost: number;
  extraCost: number;
  extraCostNote: string | null;
  totalCost: number;
  suggestedPrice: number;
  salePrice: number;
  shopeeFee: number;
  shopeeNet: number;
  shopeeProfit: number;
  overShopeeTier: boolean;
  createdAt: string;
  items: QuoteItemDTO[];
};

export function toQuoteDTO(quote: Quote & { items: QuoteItem[] }): QuoteDTO {
  const suggestedPrice = Number(quote.suggestedPrice);
  const salePrice = Number(quote.salePrice);
  const totalCost = Number(quote.totalCost);
  const shopeeNet = Number(quote.shopeeNet);

  return {
    id: quote.id,
    productName: quote.productName,
    customerName: quote.customerName,
    customerPhone: quote.customerPhone,
    printTimeHours: Number(quote.printTimeHours),
    printCostPerHour: Number(quote.printCostPerHour),
    printCost: Number(quote.printCost),
    filamentCost: Number(quote.filamentCost),
    extraCost: Number(quote.extraCost),
    extraCostNote: quote.extraCostNote,
    totalCost,
    suggestedPrice,
    salePrice,
    shopeeFee: Number(quote.shopeeFee),
    shopeeNet,
    shopeeProfit: round(shopeeNet - totalCost),
    overShopeeTier: salePrice > SHOPEE_TIER_LIMIT,
    createdAt: quote.createdAt.toISOString(),
    items: quote.items.map((item) => ({
      id: item.id,
      filamentId: item.filamentId,
      colorName: item.colorName,
      gramsUsed: item.gramsUsed,
      pricePerGram: Number(item.pricePerGram),
      lineCost: Number(item.lineCost),
    })),
  };
}
