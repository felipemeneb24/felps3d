"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FilamentDTO } from "@/lib/filament";
import { calculateQuote, round, DEFAULT_PRINT_COST_PER_HOUR, SHOPEE_TIER_LIMIT } from "@/lib/quote";
import type { StockPieceDTO } from "@/lib/stock-piece";
import { Field, inputClass } from "@/components/form";
import { IconTrash, IconEdit, IconGrid } from "@/components/icons";
import CostBreakdown from "@/components/CostBreakdown";
import SellPieceForm from "./SellPieceForm";
import SellShopeeForm from "./SellShopeeForm";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Line = { key: string; filamentId: string; gramsUsed: string };

function newLine(): Line {
  return { key: crypto.randomUUID(), filamentId: "", gramsUsed: "" };
}

const EMPTY_STATE = {
  productName: "",
  printTimeHours: "",
  printCostPerHour: String(DEFAULT_PRINT_COST_PER_HOUR),
  extraCost: "",
  extraCostNote: "",
  quantity: "1",
  lines: [newLine()],
};

// Reduz a foto pro tamanho máximo de lado especificado e recomprime em JPEG,
// pra fotos de celular (que costumam vir enormes) não estourarem o limite salvo no banco.
function readAndCompressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function StockManager({
  filaments,
  initialPieces,
}: {
  filaments: FilamentDTO[];
  initialPieces: StockPieceDTO[];
}) {
  const [pieces, setPieces] = useState<StockPieceDTO[]>(initialPieces);
  const [view, setView] = useState<"vitrine" | "form">("vitrine");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productName, setProductName] = useState(EMPTY_STATE.productName);
  const [printTimeHours, setPrintTimeHours] = useState(EMPTY_STATE.printTimeHours);
  const [printCostPerHour, setPrintCostPerHour] = useState(EMPTY_STATE.printCostPerHour);
  const [extraCost, setExtraCost] = useState(EMPTY_STATE.extraCost);
  const [extraCostNote, setExtraCostNote] = useState(EMPTY_STATE.extraCostNote);
  const [quantity, setQuantity] = useState(EMPTY_STATE.quantity);
  // Placa com várias peças iguais: os totais abaixo (tempo/gramas) são da placa toda,
  // e a gente divide pela quantidade pra achar o custo de UMA peça (é o que fica salvo).
  const [totalMode, setTotalMode] = useState(false);
  const [lines, setLines] = useState<Line[]>(EMPTY_STATE.lines);
  const [salePrice, setSalePrice] = useState("");
  const [salePriceTouched, setSalePriceTouched] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sellingId, setSellingId] = useState<number | null>(null);
  const [sellingShopeeId, setSellingShopeeId] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockPieceDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filamentById = useMemo(() => new Map(filaments.map((f) => [f.id, f])), [filaments]);
  const expandedPiece = useMemo(
    () => pieces.find((p) => p.id === expandedId) ?? null,
    [pieces, expandedId]
  );
  const sellingPiece = useMemo(
    () => pieces.find((p) => p.id === sellingId) ?? null,
    [pieces, sellingId]
  );
  const sellingShopeePiece = useMemo(
    () => pieces.find((p) => p.id === sellingShopeeId) ?? null,
    [pieces, sellingShopeeId]
  );

  function resetForm() {
    setEditingId(null);
    setProductName(EMPTY_STATE.productName);
    setPrintTimeHours(EMPTY_STATE.printTimeHours);
    setPrintCostPerHour(EMPTY_STATE.printCostPerHour);
    setExtraCost(EMPTY_STATE.extraCost);
    setExtraCostNote(EMPTY_STATE.extraCostNote);
    setQuantity(EMPTY_STATE.quantity);
    setTotalMode(false);
    setLines([newLine()]);
    setSalePrice("");
    setSalePriceTouched(false);
    setPhotoDataUrl(null);
    setPhotoError(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleBackToVitrine() {
    resetForm();
    setView("vitrine");
  }

  function startCreate() {
    resetForm();
    setView("form");
  }

  function startEdit(piece: StockPieceDTO) {
    setEditingId(piece.id);
    setProductName(piece.productName);
    setPrintTimeHours(String(piece.printTimeHours));
    setPrintCostPerHour(String(piece.printCostPerHour));
    setExtraCost(piece.extraCost > 0 ? String(piece.extraCost) : "");
    setExtraCostNote(piece.extraCostNote ?? "");
    setQuantity(String(piece.quantity));
    // Os valores salvos já são por unidade — edição sempre entra no modo "por peça".
    setTotalMode(false);
    setLines(
      piece.items.map((item) => ({
        key: crypto.randomUUID(),
        filamentId: item.filamentId ? String(item.filamentId) : "",
        gramsUsed: String(item.gramsUsed),
      }))
    );
    setSalePrice(String(piece.salePrice));
    setSalePriceTouched(true);
    setPhotoDataUrl(piece.photoDataUrl);
    setPhotoError(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setView("form");
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.key !== key) : prev));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      const dataUrl = await readAndCompressImage(file);
      setPhotoDataUrl(dataUrl);
    } catch {
      setPhotoError("Não foi possível carregar essa foto.");
    }
  }

  // No modo "placa toda", os totais digitados valem pra todas as peças juntas —
  // dividimos pela quantidade pra chegar no custo de UMA peça (o resto do cálculo é igual).
  const divisor = useMemo(() => {
    const quantityNumber = Number(quantity);
    return totalMode && Number.isFinite(quantityNumber) && quantityNumber > 0 ? quantityNumber : 1;
  }, [totalMode, quantity]);

  const preview = useMemo(() => {
    const hours = Number(printTimeHours.replace(",", ".")) / divisor;
    const rate = Number(printCostPerHour.replace(",", "."));
    const items = lines
      .map((line) => {
        const filament = filamentById.get(Number(line.filamentId));
        const grams = round(Number(line.gramsUsed.replace(",", ".")) / divisor, 2);
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
      printTimeHours: round(hours, 2),
      printCostPerHour: rate,
      items,
      extraCost: Number.isFinite(extraCostNumber) && extraCostNumber > 0 ? extraCostNumber : undefined,
      salePrice: Number.isFinite(salePriceNumber) && salePriceNumber > 0 ? salePriceNumber : undefined,
    });
  }, [printTimeHours, printCostPerHour, lines, filamentById, salePrice, extraCost, divisor]);

  const perUnitHoursHint = useMemo(() => {
    if (!totalMode || divisor <= 1) return null;
    const hoursTotal = Number(printTimeHours.replace(",", "."));
    return Number.isFinite(hoursTotal) && hoursTotal > 0 ? round(hoursTotal / divisor, 2) : null;
  }, [totalMode, divisor, printTimeHours]);

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
    const hoursTotal = Number(printTimeHours.replace(",", "."));
    if (!Number.isFinite(hoursTotal) || hoursTotal <= 0) {
      setError("Informe um tempo de impressão válido.");
      return;
    }
    const quantityNumber = Number(quantity);
    if (!Number.isInteger(quantityNumber) || quantityNumber <= 0) {
      setError("Informe uma quantidade válida (pelo menos 1).");
      return;
    }
    const validLines = lines.filter((l) => l.filamentId && l.gramsUsed);
    if (validLines.length === 0) {
      setError("Adicione ao menos um filamento usado na peça.");
      return;
    }

    const pieceDivisor = totalMode ? quantityNumber : 1;
    const hours = round(hoursTotal / pieceDivisor, 2);
    // Gramas por peça ficam com 2 casas decimais (não arredondadas pro grama inteiro) —
    // o estoque de filamento é abatido exatamente por esse valor.
    const items = validLines.map((l) => ({
      filamentId: Number(l.filamentId),
      gramsUsed: round(Number(l.gramsUsed.replace(",", ".")) / pieceDivisor, 2),
    }));
    if (items.some((item) => item.gramsUsed <= 0)) {
      setError("Com essa quantidade, algum filamento fica com 0g por peça. Revise os totais da placa.");
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
      photoDataUrl,
      printTimeHours: hours,
      printCostPerHour: Number(printCostPerHour.replace(",", ".")),
      extraCost: Number.isFinite(extraCostNumber) && extraCostNumber > 0 ? extraCostNumber : 0,
      extraCostNote: extraCostNote.trim() || null,
      salePrice: Number.isFinite(salePriceNumber) && salePriceNumber > 0 ? salePriceNumber : undefined,
      quantity: quantityNumber,
      items,
    };

    setSubmitting(true);
    try {
      const res = await fetch(editingId ? `/api/stock-pieces/${editingId}` : "/api/stock-pieces", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Não foi possível salvar a peça.");
      }

      const saved: StockPieceDTO = await res.json();
      setPieces((prev) =>
        editingId ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]
      );
      handleBackToVitrine();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSold(piece: StockPieceDTO, channel: "DIRETA" | "SHOPEE" = "DIRETA") {
    setPieces((prev) => prev.map((p) => (p.id === piece.id ? piece : p)));
    setSellingId(null);
    setSellingShopeeId(null);
    setFlash(
      channel === "SHOPEE"
        ? `Venda de "${piece.productName}" registrada na Shopee!`
        : `Venda de "${piece.productName}" registrada!`
    );
  }

  async function handleDelete(piece: StockPieceDTO, restock: boolean) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/stock-pieces/${piece.id}?restock=${restock}`, { method: "DELETE" });
      if (res.ok) {
        setPieces((prev) => prev.filter((p) => p.id !== piece.id));
        if (editingId === piece.id) resetForm();
        if (sellingId === piece.id) setSellingId(null);
        if (sellingShopeeId === piece.id) setSellingShopeeId(null);
        setDeleteTarget(null);
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Não foi possível excluir.");
      }
    } finally {
      setDeleting(false);
    }
  }

  if (filaments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Cadastre pelo menos um filamento antes de guardar uma peça em estoque.
        </p>
      </div>
    );
  }

  if (view === "form") {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-medium">{editingId ? "Editar peça em estoque" : "Nova peça em estoque"}</h2>
          <button
            type="button"
            onClick={handleBackToVitrine}
            className="text-sm text-muted-foreground hover:underline"
          >
            {editingId ? "Cancelar edição" : "Voltar pra vitrine"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
            <input
              type="checkbox"
              id="total-mode"
              checked={totalMode}
              onChange={(e) => setTotalMode(e.target.checked)}
              className="mt-0.5"
            />
            <label htmlFor="total-mode" className="text-sm">
              <span className="font-medium">É uma placa com várias peças iguais?</span>{" "}
              <span className="text-muted-foreground">
                Marque e informe o tempo e as gramas da placa toda — a gente divide pela
                quantidade pra achar o custo de cada peça.
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Nome do produto" required>
                <input
                  className={inputClass}
                  placeholder="Ex: Vaso geométrico P"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </Field>
            </div>
            <Field label={totalMode ? "Quantidade que a placa rende" : "Quantidade em estoque"} required>
              <input
                className={inputClass}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>

            <Field
              label={totalMode ? "Tempo de impressão da placa toda (horas)" : "Tempo de impressão (horas)"}
              required
            >
              <input
                className={inputClass}
                placeholder={totalMode ? "Ex: 4 (a placa toda)" : "Ex: 3.5 (3h30)"}
                inputMode="decimal"
                value={printTimeHours}
                onChange={(e) => setPrintTimeHours(e.target.value)}
              />
              {totalMode && perUnitHoursHint != null && (
                <p className="mt-1 text-xs text-muted-foreground">{perUnitHoursHint}h por peça</p>
              )}
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

          <Field label="Foto do produto">
            <div className="flex items-center gap-3">
              {photoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoDataUrl}
                  alt="Prévia da peça"
                  className="h-20 w-20 rounded-md border border-border object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                  <IconGrid className="h-6 w-6" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent-soft"
                />
                {photoDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="self-start text-xs text-muted-foreground hover:text-danger"
                  >
                    Remover foto
                  </button>
                )}
                {photoError && <p className="text-xs text-danger">{photoError}</p>}
              </div>
            </div>
          </Field>

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
              {totalMode
                ? "As gramas são da placa toda — a gente divide pela quantidade pra achar quanto vai em cada peça."
                : "As gramas são por unidade — abatemos do estoque de filamento gramas × quantidade."}
            </p>

            <div className="flex flex-col gap-2">
              {lines.map((line) => {
                const gramsRaw = Number(line.gramsUsed.replace(",", "."));
                // Valor exato da divisão (não arredondado pro inteiro que vai ser salvo),
                // só pra você saber quanto realmente vai em cada peça.
                const perUnitGrams =
                  totalMode && divisor > 1 && Number.isFinite(gramsRaw) && gramsRaw > 0
                    ? round(gramsRaw / divisor, 2)
                    : null;
                return (
                  <div key={line.key} className="flex flex-col gap-2 sm:flex-row sm:items-start">
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
                    <div className="sm:w-36">
                      <input
                        className={inputClass}
                        placeholder={totalMode ? "Gramas (da placa toda)" : "Gramas (por unidade)"}
                        inputMode="decimal"
                        value={line.gramsUsed}
                        onChange={(e) => updateLine(line.key, { gramsUsed: e.target.value })}
                      />
                      {perUnitGrams != null && (
                        <p className="mt-1 text-xs text-muted-foreground">{perUnitGrams}g por peça</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length === 1}
                      className="self-end rounded-md p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-30 sm:self-start"
                      aria-label="Remover filamento"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
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
                perPiece={totalMode}
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
              {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar peça"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Vitrine ({pieces.length} {pieces.length === 1 ? "modelo" : "modelos"})
        </h2>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          + Cadastrar peça
        </button>
      </div>

      {flash && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm">
          <span>{flash}</span>
          <button onClick={() => setFlash(null)} className="text-muted-foreground hover:text-foreground">
            Fechar
          </button>
        </div>
      )}

      {pieces.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma peça em estoque ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {pieces.map((piece) => {
            return (
              <div key={piece.id} className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
                  {piece.photoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={piece.photoDataUrl}
                      alt={piece.productName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <IconGrid className="h-7 w-7 text-muted-foreground/40" />
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{piece.productName}</p>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => startEdit(piece)}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Editar peça"
                        title="Editar"
                      >
                        <IconEdit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(piece)}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                        aria-label="Excluir peça"
                        title="Excluir"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-accent">{formatBRL(piece.salePrice)}</p>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {piece.quantity} un.
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSellingId(piece.id)}
                      disabled={piece.quantity <= 0}
                      className="flex-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                    >
                      {piece.quantity <= 0 ? "Esgotado" : "Vender"}
                    </button>
                    <button
                      onClick={() => setSellingShopeeId(piece.id)}
                      disabled={piece.quantity <= 0}
                      className="flex-1 rounded-md border border-[#F53D2D]/40 bg-[#F53D2D]/10 px-3 py-1.5 text-xs font-medium text-[#F53D2D] transition-colors hover:bg-[#F53D2D]/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
                    >
                      Shopee
                    </button>
                  </div>

                  <button
                    onClick={() => setExpandedId(piece.id)}
                    className="self-start text-xs font-medium text-accent hover:underline"
                  >
                    Ver detalhes
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expandedPiece && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setExpandedId(null)}
            aria-hidden
          />
          <div className="relative flex max-h-[85vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{expandedPiece.productName}</h3>
              <button
                type="button"
                onClick={() => setExpandedId(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
                aria-label="Fechar detalhes"
              >
                Fechar
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              {expandedPiece.items.map((item) => (
                <span
                  key={item.id}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {item.colorName}: {item.gramsUsed}g
                </span>
              ))}
            </div>

            <CostBreakdown
              printCost={expandedPiece.printCost}
              filamentCost={expandedPiece.filamentCost}
              extraCost={expandedPiece.extraCost}
              extraCostNote={expandedPiece.extraCostNote}
              totalCost={expandedPiece.totalCost}
              suggestedPrice={expandedPiece.suggestedPrice}
              salePrice={expandedPiece.salePrice}
              shopeeFee={expandedPiece.shopeeFee}
              shopeeProfit={expandedPiece.shopeeProfit}
              overShopeeTier={expandedPiece.overShopeeTier}
            />
          </div>
        </div>
      )}

      {sellingPiece && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSellingId(null)}
            aria-hidden
          />
          <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">Vender “{sellingPiece.productName}”</h3>
              <button
                type="button"
                onClick={() => setSellingId(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
                aria-label="Fechar"
              >
                Fechar
              </button>
            </div>
            <SellPieceForm
              pieceId={sellingPiece.id}
              availableQuantity={sellingPiece.quantity}
              unitPrice={sellingPiece.salePrice}
              onCancel={() => setSellingId(null)}
              onSold={(p) => handleSold(p, "DIRETA")}
            />
          </div>
        </div>
      )}

      {sellingShopeePiece && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSellingShopeeId(null)}
            aria-hidden
          />
          <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">Vender “{sellingShopeePiece.productName}” na Shopee</h3>
              <button
                type="button"
                onClick={() => setSellingShopeeId(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
                aria-label="Fechar"
              >
                Fechar
              </button>
            </div>
            <SellShopeeForm
              pieceId={sellingShopeePiece.id}
              availableQuantity={sellingShopeePiece.quantity}
              defaultSalePrice={sellingShopeePiece.salePrice}
              onCancel={() => setSellingShopeeId(null)}
              onSold={(p) => handleSold(p, "SHOPEE")}
            />
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !deleting && setDeleteTarget(null)}
            aria-hidden
          />
          <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-lg">
            <div>
              <h3 className="font-medium">Excluir “{deleteTarget.productName}”?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                O que aconteceu com o filamento usado nessa peça?
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteTarget, true)}
                className="rounded-md bg-accent px-4 py-2.5 text-left text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                Devolver ao estoque
                <span className="block text-xs font-normal opacity-90">
                  A peça não foi usada — o filamento continua disponível.
                </span>
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteTarget, false)}
                className="rounded-md border border-border px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
              >
                Não devolver
                <span className="block text-xs font-normal text-muted-foreground">
                  A peça estragou, foi doada ou usada de outra forma.
                </span>
              </button>
            </div>

            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="self-end text-sm text-muted-foreground hover:underline disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
