import { prisma } from "@/lib/prisma";
import { toOrderDTO } from "@/lib/order";
import OrdersList from "./OrdersList";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const orders = await prisma.order.findMany({
    where: { saleChannel: "DIRETA" },
    orderBy: [{ createdAt: "desc" }],
    include: { items: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos fechados a partir de orçamentos, com os dados do cliente, o
          prazo de entrega e o andamento de cada um. Pedidos da Shopee ficam
          na aba própria.
        </p>
      </div>

      <OrdersList initialOrders={orders.map(toOrderDTO)} />
    </div>
  );
}
