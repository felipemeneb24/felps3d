import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { toCustomerDTO } from "@/lib/customer";
import CustomerManager from "./CustomerManager";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  await requireUser();
  const customers = await prisma.customer.findMany({ orderBy: [{ name: "asc" }] });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastro simples de clientes. Ao fechar um pedido, o cliente é
          reconhecido automaticamente pelo telefone.
        </p>
      </div>

      <CustomerManager initialCustomers={customers.map(toCustomerDTO)} />
    </div>
  );
}
