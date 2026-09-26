import type { StockPiece, StockPieceItem } from "@/generated/prisma/client";
import { round, SHOPEE_COMMISSION_RATE, SHOPEE_FIXED_FEE, SHOPEE_TIER_LIMIT } from "@/lib/quote";

export type StockPieceItemDTO = {
  id: number;
  filamentId: number | null;
  colorName: string;
  gramsUsed: number;
  pricePerGram: number;
  lineCost: number;
};

export type StockPieceDTO = {
  id: number;
  productName: string;
  photoDataUrl: string | null;
  printTimeHours: number;
  printCostPerHour: number;
  printCost: number;
  filamentCost: number;
  extraCost: number;
  extraCostNote: string | null;
  totalCost: number;
  suggestedPrice: number;
  salePrice: number;
  quantity: number;
  /** Lucro por unidade vendendo direto (fora Shopee): salePrice - totalCost. */
  profit: number;
  shopeeFee: number;
  shopeeNet: number;
  /** Lucro por unidade se vendida na Shopee, só de referência (what-if). */
  shopeeProfit: number;
  overShopeeTier: boolean;
  createdAt: string;
  updatedAt: string;
  items: StockPieceItemDTO[];
};

export function toStockPieceDTO(piece: StockPiece & { items: StockPieceItem[] }): StockPieceDTO {
  const totalCost = Number(piece.totalCost);
  const salePrice = Number(piece.salePrice);
  // shopeeFee/shopeeNet não ficam salvos — são só uma referência do que aconteceria
  // se essa peça fosse vendida na Shopee, recalculada a partir do preço atual.
  const shopeeFee = round(salePrice * SHOPEE_COMMISSION_RATE + SHOPEE_FIXED_FEE);
  const shopeeNet = round(salePrice - shopeeFee);

  return {
    id: piece.id,
    productName: piece.productName,
    photoDataUrl: piece.photoDataUrl,
    printTimeHours: Number(piece.printTimeHours),
    printCostPerHour: Number(piece.printCostPerHour),
    printCost: Number(piece.printCost),
    filamentCost: Number(piece.filamentCost),
    extraCost: Number(piece.extraCost),
    extraCostNote: piece.extraCostNote,
    totalCost,
    suggestedPrice: Number(piece.suggestedPrice),
    salePrice,
    quantity: piece.quantity,
    profit: round(salePrice - totalCost),
    shopeeFee,
    shopeeNet,
    shopeeProfit: round(shopeeNet - totalCost),
    overShopeeTier: salePrice > SHOPEE_TIER_LIMIT,
    createdAt: piece.createdAt.toISOString(),
    updatedAt: piece.updatedAt.toISOString(),
    items: piece.items.map((item) => ({
      id: item.id,
      filamentId: item.filamentId,
      colorName: item.colorName,
      gramsUsed: Number(item.gramsUsed),
      pricePerGram: Number(item.pricePerGram),
      lineCost: Number(item.lineCost),
    })),
  };
}
