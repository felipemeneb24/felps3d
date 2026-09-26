"use client";

import { useState } from "react";
import { round, SHOPEE_TIER_LIMIT } from "@/lib/quote";

function formatBRL(value: number, minimumFractionDigits = 2) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits,
    maximumFractionDigits: 4,
  });
}

function Row({
  label,
  value,
  negative,
  strong,
  accent,
  signed,
}: {
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
  accent?: boolean;
  /** Pra linhas de resultado (lucro): mostra o sinal de fato do valor, e vira
   * vermelho quando negativo, em vez do "−" fixo usado só pra indicar subtração. */
  signed?: boolean;
}) {
  const isNegativeResult = signed && value < 0;
  const colorClass = isNegativeResult ? "text-danger" : accent ? "text-accent" : "";

  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? "font-semibold" : "font-medium"} ${colorClass}`}>
        {negative || isNegativeResult ? "− " : ""}
        {formatBRL(Math.abs(value))}
      </span>
    </div>
  );
}

export default function CostBreakdown({
  printCost,
  filamentCost,
  extraCost = 0,
  extraCostNote,
  totalCost,
  suggestedPrice,
  salePrice,
  shopeeFee,
  shopeeProfit,
  overShopeeTier,
  initialShowShopee = false,
  /** Pedido já fechado num canal fixo. Quando "SHOPEE", esconde o "Lucro" genérico
   * (que ignora a taxa) e trava a seção da Shopee sempre visível, sem botão pra fechar,
   * já que ali o lucro líquido é o único que reflete a venda de fato. Quando "DIRETA",
   * nem mostra a opção de abrir a Shopee — o canal já está decidido e não é aquele. */
  lockedSaleChannel,
  perPiece = false,
}: {
  printCost: number;
  filamentCost: number;
  /** Custo extra opcional, fora impressão e filamento (ex: parafuso, LED, outro material). */
  extraCost?: number;
  extraCostNote?: string | null;
  totalCost: number;
  suggestedPrice: number;
  salePrice: number;
  shopeeFee: number;
  shopeeProfit: number;
  overShopeeTier: boolean;
  /** Mostra a seção da Shopee já aberta (ex: pedido que foi vendido por lá). */
  initialShowShopee?: boolean;
  lockedSaleChannel?: "DIRETA" | "SHOPEE";
  /** Valores já divididos de uma placa com várias peças — deixa explícito que são por peça. */
  perPiece?: boolean;
}) {
  const isLockedShopee = lockedSaleChannel === "SHOPEE";
  const isLockedDireta = lockedSaleChannel === "DIRETA";
  const [showShopee, setShowShopee] = useState(initialShowShopee);
  const profit = round(salePrice - totalCost);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-md border border-border">
        <div className="flex flex-col divide-y divide-border">
          <Row label="Custo de impressão (máquina)" value={printCost} />
          <Row label="Custo de filamento" value={filamentCost} />
          {extraCost > 0 && (
            <Row
              label={extraCostNote ? `Custo adicional (${extraCostNote})` : "Custo adicional"}
              value={extraCost}
            />
          )}
          <Row label={perPiece ? "Custo de cada peça" : "Custo total de produção"} value={totalCost} strong />
          <Row
            label={perPiece ? "Valor sugerido de cada peça (2x o custo)" : "Valor sugerido (2x o custo)"}
            value={suggestedPrice}
          />
          <Row label="Preço de venda" value={salePrice} strong accent />
          {!isLockedShopee && <Row label="Lucro" value={profit} strong accent signed />}
        </div>
      </div>

      {!isLockedShopee && !isLockedDireta && (
        <button
          type="button"
          onClick={() => setShowShopee((v) => !v)}
          className="self-start text-sm font-medium text-accent hover:underline"
        >
          {showShopee ? "Ocultar Shopee" : "Shopee"}
        </button>
      )}

      {(isLockedShopee || showShopee) && (
        <div className="overflow-hidden rounded-md border border-accent/30 bg-accent-soft">
          <div className="px-4 pt-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Vendendo na Shopee por {formatBRL(salePrice)}
          </div>
          <div className="flex flex-col divide-y divide-accent/15">
            <Row label="Taxa da Shopee (20% + R$4,00)" value={shopeeFee} negative />
            <Row label="Custo de produção" value={totalCost} negative />
            <Row label="Lucro líquido na Shopee" value={shopeeProfit} strong accent signed />
          </div>
          {overShopeeTier && (
            <p className="px-4 pb-3 pt-1 text-xs text-muted-foreground">
              ⚠ Valor acima de {formatBRL(SHOPEE_TIER_LIMIT)} — a taxa da Shopee pode seguir outra
              regra nessa faixa, confira no seu painel de vendedor.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
