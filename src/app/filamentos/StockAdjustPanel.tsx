"use client";

import { useState } from "react";
import type { FilamentDTO } from "@/lib/filament";
import { inputClass } from "@/components/form";

export default function StockAdjustPanel({
  filament,
  onUpdated,
}: {
  filament: FilamentDTO;
  onUpdated: (updated: FilamentDTO) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function send(body: Record<string, number>) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/filaments/${filament.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível ajustar o estoque.");
      }
      const updated: FilamentDTO = await res.json();
      onUpdated(updated);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleAdd() {
    const grams = Number(value.replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0) {
      setError("Informe uma quantidade de gramas válida.");
      return;
    }
    send({ addGrams: grams });
  }

  function handleSetExact() {
    const grams = Number(value.replace(",", "."));
    if (!Number.isFinite(grams) || grams < 0) {
      setError("Informe o peso pesado, em gramas.");
      return;
    }
    send({ stockGrams: grams });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">
        Estoque atual de {filament.colorName}: <strong>{filament.stockGrams}g</strong>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} w-28`}
          placeholder="Gramas"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          disabled={submitting}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={submitting}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        >
          + Adicionar
        </button>
        <button
          type="button"
          onClick={handleSetExact}
          disabled={submitting}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          title="Use depois de pesar o rolo — substitui o valor atual pelo peso informado"
        >
          Ajustar para este peso
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
