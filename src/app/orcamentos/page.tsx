import { prisma } from "@/lib/prisma";
import { toFilamentDTO } from "@/lib/filament";
import { toQuoteDTO } from "@/lib/quote";
import QuoteManager from "./QuoteManager";

export const dynamic = "force-dynamic";

export default async function OrcamentosPage() {
  const [filaments, quotes] = await Promise.all([
    prisma.filament.findMany({ orderBy: [{ colorName: "asc" }] }),
    prisma.quote.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: { items: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Orçamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monte o orçamento de uma peça (mesmo que use vários filamentos, como
          peças multicolor) e veja o preço sugerido calculado automaticamente.
        </p>
      </div>

      <QuoteManager
        filaments={filaments.map(toFilamentDTO)}
        initialQuotes={quotes.map(toQuoteDTO)}
      />
    </div>
  );
}
