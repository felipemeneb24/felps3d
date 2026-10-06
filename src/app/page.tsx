import Link from "next/link";
import type { ComponentType } from "react";
import { prisma } from "@/lib/prisma";
import { toFilamentDTO } from "@/lib/filament";
import { resolveMonthFilter, shiftMonthParam } from "@/lib/month";
import {
  IconSpool,
  IconPackage,
  IconCalculator,
  IconUsers,
  IconGrid,
  IconShoppingBag,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/icons";

export const dynamic = "force-dynamic";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

type PageProps = {
  searchParams: Promise<{ mes?: string }>;
};

type ChannelTotals = { pedidos: number; vendas: number; lucro: number };

type IconComponent = ComponentType<{ className?: string }>;

type OrderChannelGroup = {
  saleChannel: string;
  _count: number;
  _sum: { salePrice: unknown; totalCost: unknown; shopeeNet: unknown };
};

// Valor de vendas é o que de fato entra no caixa: na venda direta é o preço de
// venda, e na Shopee é o valor vendido já sem as taxas da plataforma (shopeeNet).
// O lucro parte desse mesmo valor recebido e desconta o custo de produção.
function totalsByChannel(grupos: OrderChannelGroup[]) {
  const direta: ChannelTotals = { pedidos: 0, vendas: 0, lucro: 0 };
  const shopee: ChannelTotals = { pedidos: 0, vendas: 0, lucro: 0 };
  for (const grupo of grupos) {
    const salePrice = Number(grupo._sum.salePrice ?? 0);
    const totalCost = Number(grupo._sum.totalCost ?? 0);
    const isShopee = grupo.saleChannel === "SHOPEE";
    const recebidoLiquido = isShopee ? Number(grupo._sum.shopeeNet ?? 0) : salePrice;
    const canal = isShopee ? shopee : direta;

    canal.pedidos += grupo._count;
    canal.vendas += recebidoLiquido;
    canal.lucro += recebidoLiquido - totalCost;
  }
  return {
    direta,
    shopee,
    pedidos: direta.pedidos + shopee.pedidos,
    vendas: direta.vendas + shopee.vendas,
    lucro: direta.lucro + shopee.lucro,
  };
}

export default async function Home({ searchParams }: PageProps) {
  const { mes } = await searchParams;
  const month = resolveMonthFilter(mes);

  // "Hoje" é sempre o dia atual (horário local do servidor), independente do mês escolhido.
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const orderSums = { salePrice: true, totalCost: true, shopeeNet: true } as const;

  const [filaments, totalOrcamentosMes, totalClientes, estoquePecasAgregado, pedidosAgregadoMes, pedidosAgregadoHoje] =
    await Promise.all([
      prisma.filament.findMany().then((rows) => rows.map(toFilamentDTO)),
      prisma.quote.count({ where: { createdAt: { gte: month.start, lt: month.end } } }),
      prisma.customer.count(),
      prisma.stockPiece.aggregate({ _count: true, _sum: { quantity: true } }),
      prisma.order.groupBy({
        by: ["saleChannel"],
        where: { createdAt: { gte: month.start, lt: month.end } },
        _count: true,
        _sum: orderSums,
      }),
      prisma.order.groupBy({
        by: ["saleChannel"],
        where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
        _count: true,
        _sum: orderSums,
      }),
    ]);

  const totalCores = filaments.length;
  const totalGramas = filaments.reduce((sum, f) => sum + f.stockGrams, 0);
  const valorEstoque = filaments.reduce((sum, f) => sum + f.stockValue, 0);

  // "Pedidos fechados" conta só venda direta; a Shopee tem seus próprios indicadores,
  // mas continua entrando no valor total em vendas e no lucro total.
  const totaisMes = totalsByChannel(pedidosAgregadoMes);
  const { direta, shopee } = totaisMes;
  const valorVendasMes = totaisMes.vendas;
  const lucroMes = totaisMes.lucro;
  const hoje = totalsByChannel(pedidosAgregadoHoje);
  const todayLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const margemMes = valorVendasMes > 0 ? (lucroMes / valorVendasMes) * 100 : null;
  const participacaoShopee = valorVendasMes > 0 ? (shopee.vendas / valorVendasMes) * 100 : 0;

  const totalModelosEstoque = estoquePecasAgregado._count;
  const totalUnidadesEstoque = estoquePecasAgregado._sum.quantity ?? 0;

  const monthLabel = month.label.charAt(0).toUpperCase() + month.label.slice(1);
  const prevParam = shiftMonthParam(month.year, month.monthIndex, -1);
  const nextParam = shiftMonthParam(month.year, month.monthIndex, 1);

  // Cadastro/estoque não tem "mês" — refletem sempre o estado atual.
  const inventoryStats: { label: string; value: string; hint?: string; icon: IconComponent }[] = [
    { label: "Cores cadastradas", value: String(totalCores), icon: IconSpool },
    {
      label: "Estoque de filamento",
      value: `${(totalGramas / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`,
      hint: `${totalGramas.toLocaleString("pt-BR")} g`,
      icon: IconSpool,
    },
    { label: "Valor investido em estoque", value: formatBRL(valorEstoque), icon: IconCalculator },
    {
      label: "Peças prontas em estoque",
      value: String(totalUnidadesEstoque),
      hint: `${totalModelosEstoque} ${totalModelosEstoque === 1 ? "modelo" : "modelos"}`,
      icon: IconGrid,
    },
    { label: "Clientes cadastrados", value: String(totalClientes), icon: IconUsers },
  ];

  const modules: { href: string; label: string; icon: IconComponent; shopee?: boolean }[] = [
    { href: "/pedidos", label: "Pedidos", icon: IconPackage },
    { href: "/shopee", label: "Shopee", icon: IconShoppingBag, shopee: true },
    { href: "/orcamentos", label: "Orçamentos", icon: IconCalculator },
    { href: "/filamentos", label: "Filamentos", icon: IconSpool },
    { href: "/estoque", label: "Estoque", icon: IconGrid },
    { href: "/clientes", label: "Clientes", icon: IconUsers },
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Visão geral da Felps 3D</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Painel</h1>
        </div>

        <div className="flex items-center gap-2">
          {!month.isCurrent && (
            <Link href="/" className="mr-1 text-sm text-accent hover:underline">
              Mês atual
            </Link>
          )}

          <div className="flex items-center rounded-lg border border-border bg-card p-1">
            <Link
              href={`/?mes=${prevParam}`}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Mês anterior"
              title="Mês anterior"
            >
              <IconChevronLeft className="h-4 w-4" />
            </Link>

            <form action="/" className="flex items-center">
              <input
                type="month"
                name="mes"
                defaultValue={month.param}
                aria-label="Mês"
                className="rounded-md bg-transparent px-2 py-1 text-sm"
              />
              <button
                type="submit"
                className="rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Ver
              </button>
            </form>

            <Link
              href={`/?mes=${nextParam}`}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Próximo mês"
              title="Próximo mês"
            >
              <IconChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <section className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-accent/40 bg-linear-to-r from-accent-soft via-card to-card px-6 py-5">
        <div className="min-w-44">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Hoje</p>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground first-letter:uppercase">{todayLabel}</p>
        </div>

        <div className="mr-auto">
          <p className="text-sm text-muted-foreground">Vendas em geral</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatBRL(hoje.vendas)}</p>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Pedidos</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{hoje.pedidos}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Venda direta</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{formatBRL(hoje.direta.vendas)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Shopee</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{formatBRL(hoje.shopee.vendas)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lucro</dt>
            <dd className={`mt-0.5 font-medium tabular-nums ${hoje.lucro < 0 ? "text-danger" : "text-emerald-400"}`}>
              {formatBRL(hoje.lucro)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title={`Vendas em ${monthLabel}`} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-linear-to-br from-accent-soft to-card p-6">
            <p className="text-sm text-muted-foreground">Valor total em vendas</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
              {formatBRL(valorVendasMes)}
            </p>

            <div className="mt-6">
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                <div className="bg-accent" style={{ width: `${valorVendasMes > 0 ? 100 - participacaoShopee : 0}%` }} />
                <div className="bg-[#F53D2D]" style={{ width: `${participacaoShopee}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <Legend color="bg-accent" label="Venda direta" value={formatBRL(direta.vendas)} />
                <Legend color="bg-[#F53D2D]" label="Shopee" value={formatBRL(shopee.vendas)} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-linear-to-br from-emerald-500/10 to-card p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted-foreground">Lucro total</p>
              {margemMes !== null && (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                  margem {formatPercent(margemMes)}
                </span>
              )}
            </div>
            <p
              className={`mt-2 text-4xl font-semibold tracking-tight tabular-nums ${
                lucroMes < 0 ? "text-danger" : "text-emerald-400"
              }`}
            >
              {formatBRL(lucroMes)}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
              <div>
                <p className="text-muted-foreground">Venda direta</p>
                <p className="mt-0.5 font-medium tabular-nums">{formatBRL(direta.lucro)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Shopee</p>
                <p className="mt-0.5 font-medium tabular-nums">{formatBRL(shopee.lucro)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ChannelCard
            title="Venda direta"
            href="/pedidos"
            icon={IconPackage}
            countLabel="Pedidos fechados"
            totals={direta}
            iconClass="bg-accent-soft text-accent"
          />
          <ChannelCard
            title="Shopee"
            href="/shopee"
            icon={IconShoppingBag}
            countLabel="Vendas na Shopee"
            salesLabel="Vendas (valor final)"
            totals={shopee}
            iconClass="border border-[#F53D2D]/40 bg-[#F53D2D]/10 text-[#F53D2D]"
          />
          <Link
            href="/orcamentos"
            className="group flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-accent"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-accent">
                <IconCalculator className="h-4.5 w-4.5" />
              </span>
              <p className="font-medium">Orçamentos</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">{totalOrcamentosMes}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {totalOrcamentosMes === 1 ? "Orçamento salvo" : "Orçamentos salvos"} no mês
              </p>
            </div>
            <p className="border-t border-border pt-3 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
              Calcular novo orçamento →
            </p>
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Estoque e cadastros" subtitle="Situação atual" />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {inventoryStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
                <Icon className="h-4.5 w-4.5 text-muted-foreground" />
                <p className="mt-3 text-2xl font-semibold tabular-nums">{stat.value}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{stat.label}</p>
                {stat.hint && <p className="text-xs text-muted-foreground/70">{stat.hint}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Atalhos" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className={`flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors ${
                  mod.shopee ? "hover:border-[#F53D2D]" : "hover:border-accent"
                }`}
              >
                <Icon className={`h-5 w-5 ${mod.shopee ? "text-[#F53D2D]" : "text-accent"}`} />
                {mod.label}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {subtitle && <span className="text-xs text-muted-foreground/70">{subtitle}</span>}
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ChannelCard({
  title,
  href,
  icon: Icon,
  countLabel,
  salesLabel = "Vendas",
  totals,
  iconClass,
}: {
  title: string;
  href: string;
  icon: IconComponent;
  countLabel: string;
  salesLabel?: string;
  totals: ChannelTotals;
  iconClass: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-accent"
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${iconClass}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <p className="font-medium">{title}</p>
      </div>

      <div>
        <p className="text-3xl font-semibold tabular-nums">{totals.pedidos}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{countLabel}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{salesLabel}</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{formatBRL(totals.vendas)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Lucro</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{formatBRL(totals.lucro)}</dd>
        </div>
      </dl>
    </Link>
  );
}
