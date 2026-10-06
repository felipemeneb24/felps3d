import { prisma } from "@/lib/prisma";
import { toOrderDTO } from "@/lib/order";
import OrdersList from "@/app/pedidos/OrdersList";
import { IconShoppingBag } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ShopeePage() {
  const orders = await prisma.order.findMany({
    where: { saleChannel: "SHOPEE" },
    orderBy: [{ createdAt: "desc" }],
    include: { items: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#F53D2D]/40 bg-[#F53D2D]/10 text-[#F53D2D]">
            <IconShoppingBag className="h-4.5 w-4.5" />
          </span>
          <h1 className="text-2xl font-semibold">Shopee</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos vendidos pela Shopee, com prazo de envio, taxa e repasse
          calculados à parte dos pedidos de venda direta.
        </p>
      </div>

      <OrdersList initialOrders={orders.map(toOrderDTO)} />
    </div>
  );
}
