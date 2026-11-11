const LOCALE = 'pt-BR';

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** 'yyyy-mm-dd' → 'mar. de 2023'. Datas de calendário são lidas em UTC para não deslocar o dia. */
export function formatMonthYear(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeZone: 'UTC' }).format(
    new Date(`${isoDate.slice(0, 10)}T00:00:00Z`),
  );
}
