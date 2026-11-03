// Money and numbers formatted the way people read them, in one place (Intl.NumberFormat).
// formatMoney(27.5) -> "$27.50"; formatMoney(27.5, 'EUR', 'de-DE') -> "27,50 €"; formatNumber(1234.5) -> "1,234.5".
export function formatMoney(value, currency = 'USD', locale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}
export function formatNumber(value, { decimals, locale } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale, decimals == null ? {} : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}
export function formatPercent(value, { decimals = 0, locale } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n / 100);
}
