"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/form";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import PhoneLookupHint from "@/components/PhoneLookupHint";
import { SALE_CHANNEL_VALUES, SALE_CHANNEL_LABELS, type SaleChannel } from "@/lib/order";

export default function CloseOrderForm({
  quoteId,
  initialCustomerName,
  initialCustomerPhone,
  onCancel,
  onConfirmed,
}: {
  quoteId: number;
  initialCustomerName?: string | null;
  initialCustomerPhone?: string | null;
  onCancel: () => void;
  onConfirmed: () => void;
}) {
  const [customerName, setCustomerName] = useState(initialCustomerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  const [saleChannel, setSaleChannel] = useState<SaleChannel>("DIRETA");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lookupStatus = useCustomerLookup(customerPhone, setCustomerName);
  // Venda Shopee: o comprador é da Shopee, não temos telefone dele e não faz
  // sentido cadastrar como cliente próprio (a API ignora o cadastro nesse canal).
  const isShopee = saleChannel === "SHOPEE";

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (
      (!isShopee && !customerPhone.trim()) ||
      !customerName.trim() ||
      !deliveryAddress.trim() ||
      !deliveryDeadline
    ) {
      setError(
        isShopee
          ? "Preencha nome, endereço e prazo de entrega."
          : "Preencha telefone, nome, endereço e prazo de entrega."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryDeadline,
          saleChannel,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Não foi possível fechar o pedido.");
      }

      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleConfirm}
      className="flex flex-col gap-3 rounded-md border border-border bg-muted/50 p-4"
    >
      <div>
        <p className="text-sm font-medium">Fechar pedido</p>
        <p className="text-xs text-muted-foreground">
          O orçamento será apagado e vira um pedido na lista de Pedidos.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Telefone" required={!isShopee}>
          <input
            className={inputClass}
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder={isShopee ? "Não informado pela Shopee" : "Ex: (11) 99999-9999"}
            autoFocus
          />
        </Field>
        <Field label="Nome do cliente" required>
          <input
            className={inputClass}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Ex: Maria Silva"
          />
        </Field>

        <div className="sm:col-span-2 -mt-1">
          {isShopee ? (
            <p className="text-xs text-muted-foreground">
              Venda Shopee: telefone não é necessário e o cliente não será cadastrado.
            </p>
          ) : (
            <PhoneLookupHint status={lookupStatus} willRegister />
          )}
        </div>

        <div className="sm:col-span-2">
          <Field label="Endereço de entrega" required>
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade..."
            />
          </Field>
        </div>
        <Field label="Prazo de entrega" required>
          <input
            type="date"
            className={inputClass}
            value={deliveryDeadline}
            onChange={(e) => setDeliveryDeadline(e.target.value)}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Vendido como" required>
            <div className="flex flex-wrap gap-2">
              {SALE_CHANNEL_VALUES.map((channel) => (
                <button
                  type="button"
                  key={channel}
                  onClick={() => setSaleChannel(channel)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    saleChannel === channel
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border hover:border-accent"
                  }`}
                >
                  {SALE_CHANNEL_LABELS[channel]}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Salvando..." : "Confirmar pedido"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
