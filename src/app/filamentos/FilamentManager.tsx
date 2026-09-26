"use client";

import { Fragment, useMemo, useState } from "react";
import type { FilamentDTO } from "@/lib/filament";
import { IconTrash, IconPackage } from "@/components/icons";
import { Field, inputClass } from "@/components/form";
import StockAdjustPanel from "./StockAdjustPanel";

const ROLL_PRESETS = [
  { label: "1 kg (1000g)", value: 1000 },
  { label: "500 g", value: 500 },
  { label: "250 g", value: 250 },
];

const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "Nylon"];

function formatBRL(value: number, minimumFractionDigits = 2) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits,
    maximumFractionDigits: 4,
  });
}

type FormState = {
  colorName: string;
  material: string;
  brand: string;
  pricePerKg: string;
  rollWeightG: string;
  customRoll: boolean;
  stockRolls: string;
};

const EMPTY_FORM: FormState = {
  colorName: "",
  material: "",
  brand: "",
  pricePerKg: "",
  rollWeightG: "1000",
  customRoll: false,
  stockRolls: "1",
};

export default function FilamentManager({
  initialFilaments,
}: {
  initialFilaments: FilamentDTO[];
}) {
  const [filaments, setFilaments] = useState<FilamentDTO[]>(initialFilaments);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [adjustingStockId, setAdjustingStockId] = useState<number | null>(null);

  const pricePerKgNumber = Number(form.pricePerKg.replace(",", "."));
  const rollWeightNumber = Number(form.rollWeightG);

  const pricePerGram = useMemo(() => {
    if (!Number.isFinite(pricePerKgNumber) || pricePerKgNumber <= 0) return 0;
    return pricePerKgNumber / 1000;
  }, [pricePerKgNumber]);

  const rollValue = useMemo(() => {
    if (!Number.isFinite(rollWeightNumber) || rollWeightNumber <= 0) return 0;
    return pricePerGram * rollWeightNumber;
  }, [pricePerGram, rollWeightNumber]);

  const stats = useMemo(() => {
    const totalGramas = filaments.reduce((sum, f) => sum + f.stockGrams, 0);
    const valorEstoque = filaments.reduce((sum, f) => sum + f.stockValue, 0);
    return { totalCores: filaments.length, totalGramas, valorEstoque };
  }, [filaments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.colorName.trim()) {
      setError("Informe o nome da cor.");
      return;
    }
    if (!Number.isFinite(pricePerKgNumber) || pricePerKgNumber <= 0) {
      setError("Informe um valor por quilo válido.");
      return;
    }
    if (!Number.isFinite(rollWeightNumber) || rollWeightNumber <= 0) {
      setError("Informe um peso de rolo válido.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/filaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colorName: form.colorName.trim(),
          material: form.material || null,
          brand: form.brand || null,
          pricePerKg: pricePerKgNumber,
          rollWeightG: rollWeightNumber,
          stockRolls: Number(form.stockRolls) || 0,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Não foi possível salvar o filamento.");
      }

      const created: FilamentDTO = await res.json();
      setFilaments((prev) =>
        [...prev, created].sort((a, b) => a.colorName.localeCompare(b.colorName))
      );
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir este filamento?")) return;
    const res = await fetch(`/api/filaments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFilaments((prev) => prev.filter((f) => f.id !== id));
    }
  }

  function handleStockUpdated(updated: FilamentDTO) {
    setFilaments((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setAdjustingStockId(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Cores cadastradas</p>
          <p className="mt-1 text-2xl font-semibold">{stats.totalCores}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Estoque em gramas</p>
          <p className="mt-1 text-2xl font-semibold">{stats.totalGramas.toLocaleString("pt-BR")}g</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Valor investido em estoque</p>
          <p className="mt-1 text-2xl font-semibold">{formatBRL(stats.valorEstoque)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-medium">Novo filamento</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome da cor" required>
              <input
                className={inputClass}
                placeholder="Ex: Preto, Vermelho Fosco"
                value={form.colorName}
                onChange={(e) => setForm((f) => ({ ...f, colorName: e.target.value }))}
              />
            </Field>

            <Field label="Material">
              <input
                className={inputClass}
                placeholder="Ex: PLA, PETG"
                list="materiais"
                value={form.material}
                onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
              />
              <datalist id="materiais">
                {MATERIALS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>

            <Field label="Marca">
              <input
                className={inputClass}
                placeholder="Ex: Voolt3D, 3D Fila"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              />
            </Field>

            <Field label="Valor pago por quilo (R$)" required>
              <input
                className={inputClass}
                placeholder="Ex: 89.90"
                inputMode="decimal"
                value={form.pricePerKg}
                onChange={(e) => setForm((f) => ({ ...f, pricePerKg: e.target.value }))}
              />
            </Field>

            <Field label="Peso do rolo" required>
              <div className="flex flex-wrap gap-2">
                {ROLL_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.value}
                    onClick={() =>
                      setForm((f) => ({ ...f, rollWeightG: String(preset.value), customRoll: false }))
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      !form.customRoll && Number(form.rollWeightG) === preset.value
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border hover:border-accent"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, customRoll: true }))}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    form.customRoll
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border hover:border-accent"
                  }`}
                >
                  Outro
                </button>
              </div>
              {form.customRoll && (
                <input
                  className={`${inputClass} mt-1`}
                  placeholder="Peso em gramas, ex: 750"
                  inputMode="numeric"
                  value={form.rollWeightG}
                  onChange={(e) => setForm((f) => ({ ...f, rollWeightG: e.target.value }))}
                />
              )}
            </Field>

            <Field label="Rolos em estoque">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.stockRolls}
                onChange={(e) => setForm((f) => ({ ...f, stockRolls: e.target.value }))}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-1 rounded-md bg-accent-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              Valor da grama: <strong className="text-accent">{formatBRL(pricePerGram, 4)}</strong>
            </span>
            <span>
              Valor deste rolo ({rollWeightNumber || 0}g):{" "}
              <strong className="text-accent">{formatBRL(rollValue)}</strong>
            </span>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? "Salvando..." : "Cadastrar filamento"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-medium">Filamentos cadastrados</h2>
        </div>

        {filaments.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum filamento cadastrado ainda.
          </p>
        ) : (
          <>
            {/* Tabela: telas médias para cima */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Cor</th>
                    <th className="px-5 py-3 font-medium">Material</th>
                    <th className="px-5 py-3 font-medium">Marca</th>
                    <th className="px-5 py-3 font-medium">R$/kg</th>
                    <th className="px-5 py-3 font-medium">R$/g</th>
                    <th className="px-5 py-3 font-medium">Rolo</th>
                    <th className="px-5 py-3 font-medium">Valor do rolo</th>
                    <th className="px-5 py-3 font-medium">Estoque</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filaments.map((f) => (
                    <Fragment key={f.id}>
                      <tr className="border-b border-border last:border-0 hover:bg-muted/60">
                        <td className="px-5 py-3 font-medium">{f.colorName}</td>
                        <td className="px-5 py-3 text-muted-foreground">{f.material ?? "—"}</td>
                        <td className="px-5 py-3 text-muted-foreground">{f.brand ?? "—"}</td>
                        <td className="px-5 py-3">{formatBRL(f.pricePerKg)}</td>
                        <td className="px-5 py-3">{formatBRL(f.pricePerGram, 4)}</td>
                        <td className="px-5 py-3 text-muted-foreground">{f.rollWeightG}g</td>
                        <td className="px-5 py-3">{formatBRL(f.rollValue)}</td>
                        <td className={`px-5 py-3 ${f.stockGrams <= 0 ? "text-danger" : "text-muted-foreground"}`}>
                          {f.stockGrams}g
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setAdjustingStockId(adjustingStockId === f.id ? null : f.id)}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent-soft hover:text-accent"
                              aria-label="Ajustar estoque"
                              title="Ajustar estoque"
                            >
                              <IconPackage className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(f.id)}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                              aria-label="Excluir"
                              title="Excluir"
                            >
                              <IconTrash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {adjustingStockId === f.id && (
                        <tr className="border-b border-border bg-muted/40">
                          <td colSpan={9} className="px-5 py-3">
                            <StockAdjustPanel filament={f} onUpdated={handleStockUpdated} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartões: telas pequenas */}
            <ul className="divide-y divide-border md:hidden">
              {filaments.map((f) => (
                <li key={f.id} className="flex flex-col gap-2 px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{f.colorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[f.material, f.brand].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => setAdjustingStockId(adjustingStockId === f.id ? null : f.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent-soft hover:text-accent"
                        aria-label="Ajustar estoque"
                      >
                        <IconPackage className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                        aria-label="Excluir"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">R$/kg</span>
                    <span className="text-right">{formatBRL(f.pricePerKg)}</span>
                    <span className="text-muted-foreground">R$/g</span>
                    <span className="text-right">{formatBRL(f.pricePerGram, 4)}</span>
                    <span className="text-muted-foreground">Rolo</span>
                    <span className="text-right">
                      {f.rollWeightG}g · {formatBRL(f.rollValue)}
                    </span>
                    <span className="text-muted-foreground">Estoque</span>
                    <span className={`text-right ${f.stockGrams <= 0 ? "text-danger" : ""}`}>
                      {f.stockGrams}g
                    </span>
                  </div>
                  {adjustingStockId === f.id && (
                    <StockAdjustPanel filament={f} onUpdated={handleStockUpdated} />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
