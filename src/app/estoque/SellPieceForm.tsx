"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/form";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import PhoneLookupHint from "@/components/PhoneLookupHint";
import SaleQuantityField, { validateSaleQuantity } from "./SaleQuantityField";
import type { StockPieceDTO } from "@/lib/stock-piece";

export default function SellPieceForm({
  pieceId,
  availableQuantity,
  unitPrice,
  onCancel,
  onSold,
}: {
  pieceId: number;
  availableQuantity: number;
  unitPrice: number;
  onCancel: () => void;
  onSold: (piece: StockPieceDTO) => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lookupStatus = useCustomerLookup(customerPhone, setCustomerName);

  const quantityNumber = Number(quantity);
  const quantityError = validateSaleQuantity(quantityNumber, availableQuantity);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // O erro de quantidade já aparece embaixo do campo.
    if (quantityError) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/stock-pieces/${pieceId}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: quantityNumber,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Não foi possível registrar a venda.");
      }

      const updated: StockPieceDTO = await res.json();
      onSold(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleConfirm}
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 p-3"
    >
      <p className="text-xs font-medium">
        Registrar venda <span className="font-normal text-muted-foreground">(cliente é opcional)</span>
      </p>
      <SaleQuantityField
        quantity={quantity}
        onChange={setQuantity}
        availableQuantity={availableQuantity}
        unitPrice={unitPrice}
        error={quantityError}
      />
      <Field label="Nome do cliente">
        <input
          className={`${inputClass} text-sm`}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Ex: Maria Silva"
        />
      </Field>
      <Field label="Telefone">
        <input
          className={`${inputClass} text-sm`}
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="Ex: (11) 99999-9999"
        />
      </Field>
      <PhoneLookupHint status={lookupStatus} willRegister={Boolean(customerName.trim())} />

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || Boolean(quantityError)}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Salvando..." : "Confirmar venda"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
