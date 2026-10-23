import { functions } from 'kairoq';
import { format, addDays, isToday, isYesterday, parseISO } from 'date-fns';

export const api = (action, body = {}) => functions.invoke('diary', { action, ...body });

export const MEALS = [
  { id: 'breakfast', label: 'Breakfast', emoji: '🥣', share: 0.25 },
  { id: 'lunch', label: 'Lunch', emoji: '🥗', share: 0.35 },
  { id: 'dinner', label: 'Dinner', emoji: '🍲', share: 0.3 },
  { id: 'snacks', label: 'Snacks', emoji: '🍎', share: 0.1 }
];

export const ACTIVITIES = [
  { id: 'walking', label: 'Walking', emoji: '🚶' },
  { id: 'running', label: 'Running', emoji: '🏃' },
  { id: 'cycling', label: 'Cycling', emoji: '🚴' },
  { id: 'swimming', label: 'Swimming', emoji: '🏊' },
  { id: 'strength', label: 'Strength', emoji: '🏋️' },
  { id: 'hiit', label: 'HIIT', emoji: '⚡' },
  { id: 'yoga', label: 'Yoga', emoji: '🧘' },
  { id: 'dancing', label: 'Dancing', emoji: '💃' }
];
export const MET = { walking: 3.5, running: 9.8, cycling: 7.5, swimming: 8, strength: 5, yoga: 3, hiit: 8.5, dancing: 5.5 };

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Mostly sitting', hint: 'Desk job, little exercise', factor: 1.2 },
  { id: 'light', label: 'Lightly active', hint: 'Walks, exercise 1–3 days a week', factor: 1.375 },
  { id: 'moderate', label: 'Active', hint: 'Exercise 3–5 days a week', factor: 1.55 },
  { id: 'very', label: 'Very active', hint: 'Hard training 6–7 days a week', factor: 1.725 }
];

export const GOALS = [
  { id: 'lose', label: 'Lose weight', hint: 'About 0.5 kg a week', emoji: '📉', delta: -500 },
  { id: 'maintain', label: 'Stay where I am', hint: 'Eat for balance and energy', emoji: '⚖️', delta: 0 },
  { id: 'gain', label: 'Build muscle', hint: 'A gentle surplus with protein', emoji: '💪', delta: 300 }
];

// Mifflin-St Jeor resting energy × activity, adjusted for the goal; macros from body weight.
export function targets({ sex, age, height_cm, weight_kg, activity, goal }) {
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (sex === 'male' ? 5 : -161);
  const factor = (ACTIVITY_LEVELS.find((a) => a.id === activity) || ACTIVITY_LEVELS[1]).factor;
  const delta = (GOALS.find((g) => g.id === goal) || GOALS[1]).delta;
  const kcal = Math.max(sex === 'male' ? 1500 : 1200, Math.round((bmr * factor + delta) / 10) * 10);
  const protein = Math.round(weight_kg * (goal === 'gain' ? 2 : goal === 'lose' ? 1.8 : 1.6));
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(50, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal_target: kcal, protein_g: protein, carbs_g: carbs, fat_g: fat, water_ml: Math.round((weight_kg * 33) / 250) * 250 };
}

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');
export const shiftDay = (iso, n) => format(addDays(parseISO(iso), n), 'yyyy-MM-dd');
export function dayLabel(iso) {
  const d = parseISO(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, d MMM');
}
export const round = (n) => Math.round(Number(n) || 0);
export const fmt = (n) => new Intl.NumberFormat('en').format(round(n));
export function totals(entries) {
  return entries.reduce((t, e) => ({ kcal: t.kcal + e.kcal, protein: t.protein + e.protein, carbs: t.carbs + e.carbs, fat: t.fat + e.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}
