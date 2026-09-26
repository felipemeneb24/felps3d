"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FilamentDTO } from "@/lib/filament";
import { calculateQuote, DEFAULT_PRINT_COST_PER_HOUR, SHOPEE_TIER_LIMIT, type QuoteDTO } from "@/lib/quote";
import { Field, inputClass } from "@/components/form";
import { IconTrash, IconEdit } from "@/components/icons";
import CostBreakdown from "@/components/CostBreakdown";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import PhoneLookupHint from "@/components/PhoneLookupHint";
import CloseOrderForm from "./CloseOrderForm";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Line = { key: string; filamentId: string; gramsUsed: string };

function newLine(): Line {
  return { key: crypto.randomUUID(), filamentId: "", gramsUsed: "" };
}

const EMPTY_STATE = {
  productName: "",
  customerName: "",
  customerPhone: "",
  printTimeHours: "",
  printCostPerHour: String(DEFAULT_PRINT_COST_PER_HOUR),
  extraCost: "",
  extraCostNote: "",
  lines: [newLine()],
};

export default function QuoteManager({
  filaments,
  initialQuotes,
}: {
  filaments: FilamentDTO[];
  initialQuotes: QuoteDTO[];
}) {
  const [quotes, setQuotes] = useState<QuoteDTO[]>(initialQuotes);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productName, setProductName] = useState(EMPTY_STATE.productName);
  const [customerName, setCustomerName] = useState(EMPTY_STATE.customerName);
  const [customerPhone, setCustomerPhone] = useState(EMPTY_STATE.customerPhone);
  const [printTimeHours, setPrintTimeHours] = useState(EMPTY_STATE.printTimeHours);
  const [printCostPerHour, setPrintCostPerHour] = useState(EMPTY_STATE.printCostPerHour);
  const [extraCost, setExtraCost] = useState(EMPTY_STATE.extraCost);
  const [extraCostNote, setExtraCostNote] = useState(EMPTY_STATE.extraCostNote);
  const [lines, setLines] = useState<Line[]>(EMPTY_STATE.lines);
  const [salePrice, setSalePrice] = useState("");
  const [salePriceTouched, setSalePriceTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [closingOrderFor, setClosingOrderFor] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const filamentById = useMemo(() => new Map(filaments.map((f) => [f.id, f])), [filaments]);
  const phoneLookupStatus = useCustomerLookup(customerPhone, setCustomerName);

  function resetForm() {
    setEditingId(null);
    setProductName(EMPTY_STATE.productName);
    setCustomerName(EMPTY_STATE.customerName);
    setCustomerPhone(EMPTY_STATE.customerPhone);
    setPrintTimeHours(EMPTY_STATE.printTimeHours);
    setPrintCostPerHour(EMPTY_STATE.printCostPerHour);
    setExtraCost(EMPTY_STATE.extraCost);
    setExtraCostNote(EMPTY_STATE.extraCostNote);
    setLines([newLine()]);
    setSalePrice("");
    setSalePriceTouched(false);
    setError(null);
  }

  function startEdit(quote: QuoteDTO) {
    setEditingId(quote.id);
    setProductName(quote.productName);
    setCustomerName(quote.customerName ?? "");
    setCustomerPhone(quote.customerPhone ?? "");
    setPrintTimeHours(String(quote.printTimeHours));
    setPrintCostPerHour(String(quote.printCostPerHour));
    setExtraCost(quote.extraCost > 0 ? String(quote.extraCost) : "");
    setExtraCostNote(quote.extraCostNote ?? "");
    setLines(
      quote.items.map((item) => ({
        key: crypto.randomUUID(),
        filamentId: item.filamentId ? String(item.filamentId) : "",
        gramsUsed: String(item.gramsUsed),
      }))
    );
    setSalePrice(String(quote.salePrice));
    setSalePriceTouched(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.key !== key) : prev));
  }

  const preview = useMemo(() => {
    const hours = Number(printTimeHours.replace(",", "."));
    const rate = Number(printCostPerHour.replace(",", "."));
    const items = lines
      .map((line) => {
        const filament = filamentById.get(Number(line.filamentId));
        const grams = Number(line.gramsUsed.replace(",", "."));
        if (!filament || !Number.isFinite(grams) || grams <= 0) return null;
        return { colorName: filament.colorName, gramsUsed: grams, pricePerGram: filament.pricePerGram };
      })
      .filter((v): v is { colorName: string; gramsUsed: number; pricePerGram: number } => v !== null);

    if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(rate) || rate < 0 || items.length === 0) {
      return null;
    }
    const salePriceNumber = Number(salePrice.replace(",", "."));
    const extraCostNumber = Number(extraCost.replace(",", "."));
    return calculateQuote({
      printTimeHours: hours,
      printCostPerHour: rate,
      items,
      extraCost: Number.isFinite(extraCostNumber) && extraCostNumber > 0 ? extraCostNumber : undefined,
      salePrice: Number.isFinite(salePriceNumber) && salePriceNumber > 0 ? salePriceNumber : undefined,
    });
  }, [printTimeHours, printCostPerHour, lines, filamentById, salePrice, extraCost]);

  // Enquanto o usuário não mexer no preço de venda manualmente, ele acompanha o
  // valor sugerido (2x o custo) conforme os outros campos mudam.
  useEffect(() => {
    if (!salePriceTouched && preview) {
      setSalePrice(preview.suggestedPrice.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.suggestedPrice, salePriceTouched]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!productName.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    const hours = Number(printTimeHours.replace(",", "."));
    if (!Number.isFinite(hours) || hours <= 0) {
      setError("Informe um tempo de impressão válido.");
      return;
    }
    const validLines = lines.filter((l) => l.filamentId && l.gramsUsed);
    if (validLines.length === 0) {
      setError("Adicione ao menos um filamento usado na peça.");
      return;
    }

    const salePriceNumber = Number(salePrice.replace(",", "."));
    const extraCostNumber = Number(extraCost.replace(",", "."));
    if (extraCost.trim() && !Number.isFinite(extraCostNumber)) {
      setError("Informe um custo adicional válido.");
      return;
    }

    const payload = {
      productName: productName.trim(),
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      printTimeHours: hours,
      printCostPerHour: Number(printCostPerHour.replace(",", ".")),
      extraCost: Number.isFinite(extraCostNumber) && extraCostNumber > 0 ? extraCostNumber : 0,
      extraCostNote: extraCostNote.trim() || null,
      salePrice: Number.isFinite(salePriceNumber) && salePriceNumber > 0 ? salePriceNumber : undefined,
      items: validLines.map((l) => ({
        filamentId: Number(l.filamentId),
        gramsUsed: Number(l.gramsUsed.replace(",", ".")),
      })),
    };

    setSubmitting(true);
    try {
      const res = await fetch(editingId ? `/api/quotes/${editingId}` : "/api/quotes", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Não foi possível salvar o orçamento.");
      }

      const saved: QuoteDTO = await res.json();
      setQuotes((prev) =>
        editingId ? prev.map((q) => (q.id === saved.id ? saved : q)) : [saved, ...prev]
      );
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(quote: QuoteDTO) {
    if (!confirm("Excluir este orçamento?")) return;
    const res = await fetch(`/api/quotes/${quote.id}`, { method: "DELETE" });
    if (res.ok) {
      setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
      if (editingId === quote.id) resetForm();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Não foi possível excluir.");
    }
  }

  if (filaments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Cadastre pelo menos um filamento antes de montar um orçamento.
        </p>
        <Link
          href="/filamentos"
          className="mt-4 inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Cadastrar filamento
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-medium">{editingId ? "Editar orçamento" : "Novo orçamento"}</h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-muted-foreground hover:underline"
            >
              Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Field label="Nome do produto" required>
                <input
                  className={inputClass}
                  placeholder="Ex: Vaso geométrico P"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Tempo de impressão (horas)" required>
              <input
                className={inputClass}
                placeholder="Ex: 3.5 (3h30)"
                inputMode="decimal"
                value={printTimeHours}
                onChange={(e) => setPrintTimeHours(e.target.value)}
              />
            </Field>

            <Field label="Custo de impressão da máquina, por hora (R$)" required>
              <input
                className={inputClass}
                inputMode="decimal"
                value={printCostPerHour}
                onChange={(e) => setPrintCostPerHour(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Custo adicional (R$, opcional)">
              <input
                className={inputClass}
                placeholder="Ex: 5.00"
                inputMode="decimal"
                value={extraCost}
                onChange={(e) => setExtraCost(e.target.value)}
              />
            </Field>
            <Field label="Do que se trata o custo adicional">
              <input
                className={inputClass}
                placeholder="Ex: parafusos, LED, tinta"
                value={extraCostNote}
                onChange={(e) => setExtraCostNote(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Telefone do cliente (opcional)">
              <input
                className={inputClass}
                placeholder="Ex: (11) 99999-9999"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </Field>
            <Field label="Nome do cliente (opcional)">
              <input
                className={inputClass}
                placeholder="Se já souber pra quem é"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2 -mt-2">
              <PhoneLookupHint status={phoneLookupStatus} willRegister={false} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Filamentos usados na peça <span className="text-accent">*</span>
              </label>
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, newLine()])}
                className="text-sm font-medium text-accent hover:underline"
              >
                + Adicionar filamento
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Peça multicolor? Adicione uma linha para cada cor usada.
            </p>

            <div className="flex flex-col gap-2">
              {lines.map((line) => (
                <div key={line.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    className={`${inputClass} sm:flex-1`}
                    value={line.filamentId}
                    onChange={(e) => updateLine(line.key, { filamentId: e.target.value })}
                  >
                    <option value="">Selecione o filamento...</option>
                    {filaments.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.colorName}
                        {f.material ? ` (${f.material})` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${inputClass} sm:w-36`}
                    placeholder="Gramas"
                    inputMode="decimal"
                    value={line.gramsUsed}
                    onChange={(e) => updateLine(line.key, { gramsUsed: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    className="self-end rounded-md p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-30 sm:self-auto"
                    aria-label="Remover filamento"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {preview && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <Field label="Preço de venda (R$)">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={salePrice}
                      onChange={(e) => {
                        setSalePrice(e.target.value);
                        setSalePriceTouched(true);
                      }}
                    />
                  </Field>
                </div>
                {salePriceTouched && (
                  <button
                    type="button"
                    onClick={() => {
                      setSalePriceTouched(false);
                      setSalePrice(preview.suggestedPrice.toFixed(2));
                    }}
                    className="pb-2.5 text-xs text-accent hover:underline"
                  >
                    Usar valor sugerido ({formatBRL(preview.suggestedPrice)})
                  </button>
                )}
              </div>

              <CostBreakdown
                printCost={preview.printCost}
                filamentCost={preview.filamentCost}
                extraCost={preview.extraCost}
                extraCostNote={extraCostNote.trim() || null}
                totalCost={preview.totalCost}
                suggestedPrice={preview.suggestedPrice}
                salePrice={preview.salePrice}
                shopeeFee={preview.shopeeFee}
                shopeeProfit={preview.shopeeProfit}
                overShopeeTier={preview.salePrice > SHOPEE_TIER_LIMIT}
              />
            </>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar orçamento"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-medium">Orçamentos salvos</h2>
        </div>

        {flash && (
          <div className="flex items-center justify-between gap-3 border-b border-accent/30 bg-accent-soft px-5 py-3 text-sm">
            <span>{flash}</span>
            <button onClick={() => setFlash(null)} className="text-muted-foreground hover:text-foreground">
              Fechar
            </button>
          </div>
        )}

        {quotes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum orçamento salvo ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {quotes.map((q) => {
              const expanded = expandedId === q.id;
              return (
                <li key={q.id} className="flex flex-col gap-3 px-5 py-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{q.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(q.createdAt).toLocaleString("pt-BR")} · {q.printTimeHours}h de
                        impressão
                        {q.customerName && <> · Cliente: {q.customerName}</>}
                        {q.customerPhone && <> ({q.customerPhone})</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <p className="mr-1 font-semibold text-accent">{formatBRL(q.salePrice)}</p>
                      <button
                        onClick={() => startEdit(q)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Editar orçamento"
                        title="Editar"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(q)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                        aria-label="Excluir orçamento"
                        title="Excluir"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {q.items.map((item) => (
                      <span
                        key={item.id}
                        className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {item.colorName}: {item.gramsUsed}g ({formatBRL(item.lineCost)})
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => setExpandedId(expanded ? null : q.id)}
                    className="self-start text-sm font-medium text-accent hover:underline"
                  >
                    {expanded ? "Ocultar detalhes" : "Ver detalhes"}
                  </button>

                  {expanded && (
                    <CostBreakdown
                      printCost={q.printCost}
                      filamentCost={q.filamentCost}
                      extraCost={q.extraCost}
                      extraCostNote={q.extraCostNote}
                      totalCost={q.totalCost}
                      suggestedPrice={q.suggestedPrice}
                      salePrice={q.salePrice}
                      shopeeFee={q.shopeeFee}
                      shopeeProfit={q.shopeeProfit}
                      overShopeeTier={q.overShopeeTier}
                    />
                  )}

                  {closingOrderFor === q.id ? (
                    <CloseOrderForm
                      quoteId={q.id}
                      initialCustomerName={q.customerName}
                      initialCustomerPhone={q.customerPhone}
                      onCancel={() => setClosingOrderFor(null)}
                      onConfirmed={() => {
                        setQuotes((prev) => prev.filter((quote) => quote.id !== q.id));
                        setClosingOrderFor(null);
                        setFlash(`Pedido de "${q.productName}" fechado! Confira em Pedidos.`);
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setClosingOrderFor(q.id);
                        setExpandedId(q.id);
                      }}
                      className="self-start rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
                    >
                      Fechar pedido
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
