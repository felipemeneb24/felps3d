"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { OrderDTO, OrderStatus } from "@/lib/order";
import { ORDER_STATUS_VALUES, ORDER_STATUS_LABELS } from "@/lib/order";
import { IconTrash, IconEdit, IconCheck, IconClose } from "@/components/icons";
import { inputClass } from "@/components/form";
import CostBreakdown from "@/components/CostBreakdown";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateUTC(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function daysUntil(iso: string) {
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const deadline = new Date(iso);
  const deadlineUTC = Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate());
  return Math.round((deadlineUTC - todayUTC) / (1000 * 60 * 60 * 24));
}

// "AAAA-MM" (em UTC, mesma base do prazo) pra agrupar e comparar meses.
function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Próxima chave "AAAA-MM" depois da informada.
function nextMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year, month, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Pílula do status inteira preenchida com a cor (não só borda), pra bater o olho rápido.
const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDENTE: "bg-slate-500 text-white",
  EM_PRODUCAO: "bg-sky-500 text-white",
  PRONTO_PARA_ENTREGA: "bg-accent text-accent-foreground",
  ENVIADO: "bg-indigo-500 text-white",
  FINALIZADO: "bg-emerald-500 text-white",
};

type FilterKey = "todos" | "pendentes" | "finalizados" | "sem-pagar";

const FILTERS: { key: FilterKey; label: string; test: (o: OrderDTO) => boolean }[] = [
  { key: "todos", label: "Todos", test: () => true },
  { key: "pendentes", label: "Pendentes", test: (o) => o.status === "PENDENTE" },
  { key: "finalizados", label: "Finalizados", test: (o) => o.status === "FINALIZADO" },
  { key: "sem-pagar", label: "Sem pagar", test: (o) => !o.isPaid },
];

// Chave "AAAA-MM" do mês escolhido no filtro.
type PeriodFilter = string;

function matchesPeriod(order: OrderDTO, period: PeriodFilter) {
  return monthKey(order.deliveryDeadline) === period;
}

export default function OrdersList({ initialOrders }: { initialOrders: OrderDTO[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [period, setPeriod] = useState<PeriodFilter>(currentMonthKey());
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [savingPrice, setSavingPrice] = useState(false);

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const filteredOrders = useMemo(
    () => orders.filter((o) => activeFilter.test(o) && matchesPeriod(o, period)),
    [orders, activeFilter, period]
  );

  // Lista contínua de meses pra navegar como um calendário (sem buracos), do mês mais
  // antigo com pedido até o mais recente — sempre incluindo o mês atual mesmo sem pedido.
  const monthOptions = useMemo(() => {
    const current = currentMonthKey();
    let min = current;
    let max = current;
    for (const o of orders) {
      const key = monthKey(o.deliveryDeadline);
      if (key < min) min = key;
      if (key > max) max = key;
    }
    const options: { key: string; label: string }[] = [];
    for (let key = min; key <= max; key = nextMonthKey(key)) {
      options.push({ key, label: monthKeyLabel(key) });
    }
    return options;
  }, [orders]);

  // O que ainda precisa de atenção fica sempre no topo. Enviado na Shopee e sem pagar
  // já está fora das nossas mãos (só esperando a Shopee liberar) — desce, mas fica
  // acima do que já está 100% resolvido (finalizado, entregue e pago), lá no final.
  function orderPriority(order: OrderDTO) {
    if (order.status === "FINALIZADO" && order.isPaid) return 2;
    if (order.saleChannel === "SHOPEE" && order.status === "ENVIADO" && !order.isPaid) return 1;
    return 0;
  }

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => orderPriority(a) - orderPriority(b));
  }, [filteredOrders]);

  async function handleStatusChange(order: OrderDTO, status: OrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
    }
  }

  async function handleTogglePaid(order: OrderDTO) {
    const isPaid = !order.isPaid;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, isPaid } : o)));
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid }),
    });
    if (!res.ok) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
    }
  }

  function handleStartEditPrice(order: OrderDTO) {
    setEditingPriceId(order.id);
    setPriceDraft(String(order.salePrice));
    setPriceError(null);
  }

  function handleCancelEditPrice() {
    setEditingPriceId(null);
    setPriceError(null);
  }

  async function handleSaveSalePrice(order: OrderDTO) {
    const salePrice = Number(priceDraft.replace(",", "."));
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      setPriceError("Valor inválido.");
      return;
    }

    setSavingPrice(true);
    setPriceError(null);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salePrice }),
    });
    setSavingPrice(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setPriceError(body?.error ?? "Não deu pra salvar o valor.");
      return;
    }

    const updated: OrderDTO = await res.json();
    setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    setEditingPriceId(null);
  }

  async function handleDelete(order: OrderDTO) {
    if (!confirm(`Excluir de vez o pedido de ${order.customerName}? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
    if (res.ok) {
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    }
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Nenhum pedido fechado ainda.</p>
        <Link href="/orcamentos" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Ir para Orçamentos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <label htmlFor="period-filter" className="text-sm font-medium text-muted-foreground">
          Período:
        </label>
        <select
          id="period-filter"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className={`${inputClass} w-auto`}
        >
          {monthOptions.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = orders.filter((o) => f.test(o) && matchesPeriod(o, period)).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border hover:border-accent"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {sortedOrders.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum pedido nesse filtro.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {sortedOrders.map((order) => {
            const remaining = daysUntil(order.deliveryDeadline);
            // Na Shopee o prazo cadastrado é sempre o de envio, não de entrega —
            // então "Enviado" já cumpre o prazo e não deve mais contar como atraso.
            const metDeadline =
              order.status === "FINALIZADO" ||
              (order.saleChannel === "SHOPEE" && order.status === "ENVIADO");
            const overdue = remaining < 0 && !metDeadline;
            const expanded = expandedId === order.id;
            // "Enviado" só faz sentido pra pedido rastreado pela Shopee.
            const statusOptions =
              order.saleChannel === "SHOPEE"
                ? ORDER_STATUS_VALUES
                : ORDER_STATUS_VALUES.filter((status) => status !== "ENVIADO");

            return (
              <li key={order.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{order.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.customerName}
                      {order.customerPhone && <> · {order.customerPhone}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    {editingPriceId === order.id ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            autoFocus
                            value={priceDraft}
                            onChange={(e) => setPriceDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveSalePrice(order);
                              if (e.key === "Escape") handleCancelEditPrice();
                            }}
                            className={`${inputClass} w-24 text-right`}
                          />
                          <button
                            onClick={() => handleSaveSalePrice(order)}
                            disabled={savingPrice}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50"
                            title="Salvar"
                          >
                            <IconCheck className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEditPrice}
                            disabled={savingPrice}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
                            title="Cancelar"
                          >
                            <IconClose className="h-4 w-4" />
                          </button>
                        </div>
                        {priceError && <p className="text-xs text-danger">{priceError}</p>}
                      </div>
                    ) : (
                      <p className="flex items-center justify-end gap-1.5 font-semibold text-accent">
                        {formatBRL(order.salePrice)}
                        {order.saleChannel === "DIRETA" && (
                          <button
                            onClick={() => handleStartEditPrice(order)}
                            className="text-muted-foreground transition-colors hover:text-accent"
                            title="Ajustar valor de venda"
                          >
                            <IconEdit className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </p>
                    )}
                    <p className={`text-xs ${overdue ? "text-danger" : "text-muted-foreground"}`}>
                      Prazo: {formatDateUTC(order.deliveryDeadline)}
                      {overdue
                        ? ` (${Math.abs(remaining)}d atrasado)`
                        : remaining === 0
                          ? " (hoje)"
                          : remaining > 0
                            ? ` (em ${remaining}d)`
                            : ""}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">Endereço de entrega:</span>{" "}
                  {order.deliveryAddress}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {order.items.map((item) => (
                    <span key={item.id} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {item.colorName}: {item.gramsUsed}g
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order, e.target.value as OrderStatus)}
                    className={`rounded-full border-0 px-3 py-1.5 text-sm font-medium ${STATUS_STYLES[order.status]}`}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status} className="bg-background text-foreground">
                        {ORDER_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleTogglePaid(order)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      order.isPaid ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"
                    }`}
                  >
                    {order.isPaid ? "Pago" : "Sem pagar"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => setExpandedId(expanded ? null : order.id)}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    {expanded ? "Ocultar detalhes" : "Ver detalhes"}
                  </button>
                  <button
                    onClick={() => handleDelete(order)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-danger"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                    Excluir pedido
                  </button>
                </div>

                {expanded && (
                  <div className="mt-4">
                    <CostBreakdown
                      printCost={order.printCost}
                      filamentCost={order.filamentCost}
                      extraCost={order.extraCost}
                      extraCostNote={order.extraCostNote}
                      totalCost={order.totalCost}
                      suggestedPrice={order.suggestedPrice}
                      salePrice={order.salePrice}
                      shopeeFee={order.shopeeFee}
                      shopeeProfit={order.shopeeProfit}
                      overShopeeTier={order.overShopeeTier}
                      initialShowShopee={order.saleChannel === "SHOPEE"}
                      lockedSaleChannel={order.saleChannel}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
