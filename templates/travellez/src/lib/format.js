// Money, dates and status colours used across the app.
export function money(n, currency = 'CAD') {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(n) || 0);
}
export function niceDate(d) {
  if (!d) return '';
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function nights(a, b) { return Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000)); }
export const STATUS = {
  requested: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  approved: 'bg-[#fdf0f1] text-[#d0202f] ring-1 ring-[#f6c9cd]',
  booked: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  draft: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  submitted: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  inactive: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
};
export const CATEGORIES = [
  { id: 'flight', label: 'Flights', color: '#ef3444' },
  { id: 'hotel', label: 'Hotels', color: '#14161a' },
  { id: 'ground', label: 'Ground', color: '#f59e0b' },
  { id: 'meals', label: 'Meals', color: '#c9a27e' },
  { id: 'other', label: 'Other', color: '#cfccc6' }
];
