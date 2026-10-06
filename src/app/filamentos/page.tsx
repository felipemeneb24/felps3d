import { prisma } from "@/lib/prisma";
import { toFilamentDTO } from "@/lib/filament";
import FilamentManager from "./FilamentManager";

export const dynamic = "force-dynamic";

export default async function FilamentosPage() {
  const filaments = await prisma.filament.findMany({
    orderBy: [{ colorName: "asc" }],
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Filamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre as cores de filamento, o valor pago por quilo e o peso do
          rolo comprado. O valor da grama é calculado automaticamente.
        </p>
      </div>

      <FilamentManager initialFilaments={filaments.map(toFilamentDTO)} />
    </div>
  );
}
