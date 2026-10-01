"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/form";
import { IconTrash } from "@/components/icons";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import PhoneLookupHint from "@/components/PhoneLookupHint";
import type { StockPieceDTO } from "@/lib/stock-piece";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type CartLine = { pieceId: number; quantity: number };

// Fecha o carrinho da vitrine: vários modelos (e quantidades) vendidos num pedido só,
// direto (feira, cliente opcional) ou pela Shopee (mesmo fluxo de fechar orçamento).
export default function CartCheckout({
  lines,
  pieces,
  onChangeQuantity,
  onRemove,
  onCancel,
  onSold,
}: {
  lines: CartLine[];
  pieces: StockPieceDTO[];
  onChangeQuantity: (pieceId: number, quantity: number) => void;
  onRemove: (pieceId: number) => void;
  onCancel: () => void;
  onSold: (updated: StockPieceDTO[], channel: "DIRETA" | "SHOPEE") => void;
}) {
  const [channel, setChannel] = useState<"DIRETA" | "SHOPEE">("DIRETA");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  // Preço por unidade na Shopee, por peça — começa com o cadastrado, mas dá pra ajustar.
  const [shopeePrices, setShopeePrices] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lookupStatus = useCustomerLookup(channel === "DIRETA" ? customerPhone : "", setCustomerName);
  const isShopee = channel === "SHOPEE";

  const rows = lines
    .map((line) => {
      const piece = pieces.find((p) => p.id === line.pieceId);
      if (!piece) return null;
      const priceText = shopeePrices[piece.id] ?? String(piece.salePrice);
      const unitPrice = isShopee ? Number(priceText.replace(",", ".")) : piece.salePrice;
      return { line, piece, priceText, unitPrice };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const total = rows.reduce((acc, r) => acc + (Number.isFinite(r.unitPrice) ? r.unitPrice : 0) * r.line.quantity, 0);
  const totalUnits = rows.reduce((acc, r) => acc + r.line.quantity, 0);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rows.length === 0) {
      setError("O carrinho está vazio.");
      return;
    }
    if (isShopee) {
      if (!customerName.trim() || !deliveryAddress.trim() || !deliveryDeadline) {
        setError("Preencha nome, endereço e prazo de entrega.");
        return;
      }
      const invalid = rows.find((r) => !Number.isFinite(r.unitPrice) || r.unitPrice <= 0);
      if (invalid) {
        setError(`Informe um valor de venda válido para "${invalid.piece.productName}".`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/stock-pieces/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleChannel: channel,
          items: rows.map((r) => ({
            pieceId: r.piece.id,
            quantity: r.line.quantity,
            ...(isShopee ? { unitPrice: r.unitPrice } : {}),
          })),
          customerName: customerName.trim(),
          ...(isShopee
            ? { deliveryAddress: deliveryAddress.trim(), deliveryDeadline }
            : { customerPhone: customerPhone.trim() }),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Não foi possível registrar a venda.");
      }

      const updated: StockPieceDTO[] = await res.json();
      onSold(updated, channel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleConfirm} className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {rows.map(({ line, piece, priceText, unitPrice }) => (
          <li key={piece.id} className="flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{piece.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {Number.isFinite(unitPrice) ? formatBRL(unitPrice) : "—"} / un. · {piece.quantity} em estoque
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(piece.id)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                aria-label={`Tirar "${piece.productName}" do carrinho`}
                title="Tirar do carrinho"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChangeQuantity(piece.id, line.quantity - 1)}
                  disabled={line.quantity <= 1}
                  className="h-7 w-7 rounded-md border border-border text-sm transition-colors hover:bg-muted disabled:opacity-40"
                  aria-label="Diminuir quantidade"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => onChangeQuantity(piece.id, line.quantity + 1)}
                  disabled={line.quantity >= piece.quantity}
                  className="h-7 w-7 rounded-md border border-border text-sm transition-colors hover:bg-muted disabled:opacity-40"
                  aria-label="Aumentar quantidade"
                >
                  +
                </button>
              </div>
              {isShopee && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  R$/un. na Shopee
                  <input
                    className={`${inputClass} w-20 py-1 text-sm`}
                    inputMode="decimal"
                    value={priceText}
                    onChange={(e) => setShopeePrices((prev) => ({ ...prev, [piece.id]: e.target.value }))}
                  />
                </label>
              )}
              <span className="ml-auto text-sm font-medium">
                {Number.isFinite(unitPrice) ? formatBRL(unitPrice * line.quantity) : "—"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {totalUnits} {totalUnits === 1 ? "peça" : "peças"}
        </span>
        <span className="text-base font-semibold text-accent">Total: {formatBRL(total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setChannel("DIRETA")}
          className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
            !isShopee ? "border-emerald-600 bg-emerald-600 text-white" : "border-border hover:bg-muted"
          }`}
        >
          Venda direta
        </button>
        <button
          type="button"
          onClick={() => setChannel("SHOPEE")}
          className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
            isShopee ? "border-[#F53D2D] bg-[#F53D2D] text-white" : "border-border hover:bg-muted"
          }`}
        >
          Shopee
        </button>
      </div>

      <Field label="Nome do cliente" required={isShopee}>
        <input
          className={`${inputClass} text-sm`}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Ex: Maria Silva"
        />
      </Field>

      {isShopee ? (
        <>
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
        </>
      ) : (
        <>
          <Field label="Telefone">
            <input
              className={`${inputClass} text-sm`}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Ex: (11) 99999-9999"
            />
          </Field>
          <PhoneLookupHint status={lookupStatus} willRegister={Boolean(customerName.trim())} />
        </>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || rows.length === 0}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
            isShopee ? "bg-[#F53D2D] hover:bg-[#F53D2D]/90" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {submitting ? "Salvando..." : `Confirmar venda · ${formatBRL(total)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Voltar
        </button>
      </div>
    </form>
  );
}
