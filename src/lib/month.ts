// Helpers pra filtrar dados por mês no painel (query string "?mes=AAAA-MM").
// Mês é sempre em horário local do servidor — mesma referência usada pra "hoje".

export type MonthFilter = {
  year: number;
  monthIndex: number; // 0-11
  param: string; // "AAAA-MM", pro <input type="month"> e pros links de navegação
  start: Date; // início do mês, inclusive
  end: Date; // início do mês seguinte, exclusivo
  label: string; // "Setembro de 2026"
  isCurrent: boolean;
};

function toParam(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function resolveMonthFilter(rawMonth: string | undefined): MonthFilter {
  const now = new Date();
  let year = now.getFullYear();
  let monthIndex = now.getMonth();

  const match = rawMonth?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (m >= 1 && m <= 12) {
      year = y;
      monthIndex = m - 1;
    }
  }

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  const label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return {
    year,
    monthIndex,
    param: toParam(year, monthIndex),
    start,
    end,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    isCurrent: year === now.getFullYear() && monthIndex === now.getMonth(),
  };
}

export function shiftMonthParam(year: number, monthIndex: number, delta: number): string {
  const shifted = new Date(year, monthIndex + delta, 1);
  return toParam(shifted.getFullYear(), shifted.getMonth());
}
