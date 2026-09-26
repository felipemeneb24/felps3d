import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { toFilamentDTO } from "@/lib/filament";
import { toStockPieceDTO } from "@/lib/stock-piece";
import StockManager from "./StockManager";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  await requireUser();
  const [filaments, pieces] = await Promise.all([
    prisma.filament.findMany({ orderBy: [{ colorName: "asc" }] }),
    prisma.stockPiece.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: { items: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Peças em estoque</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vitrine das peças já prontas pra vender direto, como em feiras: cadastre o
          filamento usado, a quantidade e uma foto — o custo e o preço sugerido saem
          automáticos, e o estoque de filamento já é abatido.
        </p>
      </div>

      <StockManager filaments={filaments.map(toFilamentDTO)} initialPieces={pieces.map(toStockPieceDTO)} />
    </div>
  );
}
