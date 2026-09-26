"use client";

import { Field, inputClass } from "@/components/form";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Confere se dá pra vender essa quantidade (inteira, maior que zero e no máximo o
// que tem em estoque). Retorna a mensagem de erro, ou null se estiver ok.
export function validateSaleQuantity(quantity: number, availableQuantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return "Informe uma quantidade válida (número inteiro maior que zero).";
  }
  if (quantity > availableQuantity) {
    return `Quantidade indisponível: só tem ${availableQuantity} un. em estoque.`;
  }
  return null;
}

// Campo de quantidade usado nos formulários de venda de peça em estoque (venda
// final e Shopee), com o disponível e o total da venda logo abaixo.
export default function SaleQuantityField({
  quantity,
  onChange,
  availableQuantity,
  unitPrice,
  error,
}: {
  quantity: string;
  onChange: (value: string) => void;
  availableQuantity: number;
  unitPrice: number;
  error: string | null;
}) {
  const quantityNumber = Number(quantity);
  const showTotal = !error && Number.isFinite(unitPrice) && unitPrice > 0;

  return (
    <Field label="Quantidade" required>
      <input
        type="number"
        min={1}
        max={availableQuantity}
        step={1}
        className={`${inputClass} text-sm ${error ? "border-danger" : ""}`}
        value={quantity}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
      />
      <p className={`text-xs ${error ? "text-danger" : "text-muted-foreground"}`}>
        {error ??
          `Disponível: ${availableQuantity} un.${
            showTotal ? ` · Total: ${formatBRL(unitPrice * quantityNumber)}` : ""
          }`}
      </p>
    </Field>
  );
}
