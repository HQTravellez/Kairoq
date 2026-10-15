// Money, dates and status colours used across the app.
export function money(n, currency = 'EUR') {
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
  approved: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
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
  { id: 'flight', label: 'Flights', color: '#4f46e5' },
  { id: 'hotel', label: 'Hotels', color: '#14b8a6' },
  { id: 'ground', label: 'Ground', color: '#f59e0b' },
  { id: 'meals', label: 'Meals', color: '#ec4899' },
  { id: 'other', label: 'Other', color: '#94a3b8' }
];
