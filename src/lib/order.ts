import type { Order, OrderItem, OrderStatus, SaleChannel } from "@/generated/prisma/client";
import { round, SHOPEE_TIER_LIMIT } from "@/lib/quote";

export type { OrderStatus, SaleChannel };

export const ORDER_STATUS_VALUES: OrderStatus[] = [
  "PENDENTE",
  "EM_PRODUCAO",
  "PRONTO_PARA_ENTREGA",
  "ENVIADO",
  "FINALIZADO",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDENTE: "Pendente",
  EM_PRODUCAO: "Em produção",
  PRONTO_PARA_ENTREGA: "Pronto para entrega",
  ENVIADO: "Enviado",
  FINALIZADO: "Finalizado e entregue",
};

export const SALE_CHANNEL_VALUES: SaleChannel[] = ["DIRETA", "SHOPEE"];

export const SALE_CHANNEL_LABELS: Record<SaleChannel, string> = {
  DIRETA: "Venda final",
  SHOPEE: "Shopee",
};

export type OrderItemDTO = {
  id: number;
  filamentId: number | null;
  colorName: string;
  gramsUsed: number;
  pricePerGram: number;
  lineCost: number;
};

export type OrderDTO = {
  id: number;
  productName: string;
  customerName: string;
  // Nulo em pedidos vindos de uma venda de estoque (feira) sem telefone informado.
  customerPhone: string | null;
  deliveryAddress: string;
  deliveryDeadline: string;
  status: OrderStatus;
  saleChannel: SaleChannel;
  isPaid: boolean;
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
  items: OrderItemDTO[];
};

export function toOrderDTO(order: Order & { items: OrderItem[] }): OrderDTO {
  const suggestedPrice = Number(order.suggestedPrice);
  const salePrice = Number(order.salePrice);
  const totalCost = Number(order.totalCost);
  const shopeeNet = Number(order.shopeeNet);

  return {
    id: order.id,
    productName: order.productName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryDeadline: order.deliveryDeadline.toISOString(),
    status: order.status,
    saleChannel: order.saleChannel,
    isPaid: order.isPaid,
    printTimeHours: Number(order.printTimeHours),
    printCostPerHour: Number(order.printCostPerHour),
    printCost: Number(order.printCost),
    filamentCost: Number(order.filamentCost),
    extraCost: Number(order.extraCost),
    extraCostNote: order.extraCostNote,
    totalCost,
    suggestedPrice,
    salePrice,
    shopeeFee: Number(order.shopeeFee),
    shopeeNet,
    shopeeProfit: round(shopeeNet - totalCost),
    overShopeeTier: salePrice > SHOPEE_TIER_LIMIT,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      filamentId: item.filamentId,
      colorName: item.colorName,
      gramsUsed: item.gramsUsed,
      pricePerGram: Number(item.pricePerGram),
      lineCost: Number(item.lineCost),
    })),
  };
}
