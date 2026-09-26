"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/form";
import type { StockPieceDTO } from "@/lib/stock-piece";
import SaleQuantityField, { validateSaleQuantity } from "./SaleQuantityField";

export default function SellShopeeForm({
  pieceId,
  availableQuantity,
  defaultSalePrice,
  onCancel,
  onSold,
}: {
  pieceId: number;
  availableQuantity: number;
  defaultSalePrice: number;
  onCancel: () => void;
  onSold: (piece: StockPieceDTO) => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  // Preço já vem preenchido com o cadastrado, mas dá pra ajustar — a Shopee às vezes
  // vende por um valor diferente do praticado fora de lá.
  const [salePrice, setSalePrice] = useState(String(defaultSalePrice));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const quantityNumber = Number(quantity);
  const quantityError = validateSaleQuantity(quantityNumber, availableQuantity);
  const salePriceNumber = Number(salePrice.replace(",", "."));

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // O erro de quantidade já aparece embaixo do campo.
    if (quantityError) return;

    if (!customerName.trim() || !deliveryAddress.trim() || !deliveryDeadline) {
      setError("Preencha nome, endereço e prazo de entrega.");
      return;
    }
    if (!Number.isFinite(salePriceNumber) || salePriceNumber <= 0) {
      setError("Informe um valor de venda válido.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/stock-pieces/${pieceId}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleChannel: "SHOPEE",
          quantity: quantityNumber,
          customerName: customerName.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryDeadline,
          salePrice: salePriceNumber,
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
      className="flex flex-col gap-2 rounded-md border border-[#F53D2D]/30 bg-[#F53D2D]/5 p-3"
    >
      <p className="text-xs font-medium text-[#F53D2D]">
        Registrar venda Shopee <span className="font-normal text-muted-foreground">(mesmo fluxo de fechar orçamento)</span>
      </p>
      <SaleQuantityField
        quantity={quantity}
        onChange={setQuantity}
        availableQuantity={availableQuantity}
        unitPrice={salePriceNumber}
        error={quantityError}
      />
      <Field label="Nome do cliente" required>
        <input
          className={`${inputClass} text-sm`}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Ex: Maria Silva"
        />
      </Field>
      <Field label="Endereço de entrega" required>
        <textarea
          className={`${inputClass} min-h-16 resize-y text-sm`}
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          placeholder="Rua, número, bairro, cidade..."
        />
      </Field>
      <Field label="Prazo de entrega" required>
        <input
          type="date"
          className={`${inputClass} text-sm`}
          value={deliveryDeadline}
          onChange={(e) => setDeliveryDeadline(e.target.value)}
        />
      </Field>
      <Field label="Valor vendido na Shopee, por unidade (R$)" required>
        <input
          className={`${inputClass} text-sm`}
          inputMode="decimal"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
        />
      </Field>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || Boolean(quantityError)}
          className="rounded-md bg-[#F53D2D] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#F53D2D]/90 disabled:opacity-50"
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
