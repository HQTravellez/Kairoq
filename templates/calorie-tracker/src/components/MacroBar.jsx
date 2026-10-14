import { motion } from 'framer-motion';
import { round } from '../lib/fit.js';

export default function MacroBar({ label, value, target, color }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-slate-500"><span className="font-semibold text-[#0c1222]">{round(value)}</span> / {target} g</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#f2f3ee]">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: pct + '%' }} transition={{ type: 'spring', stiffness: 70, damping: 20 }} />
      </div>
    </div>
  );
}
