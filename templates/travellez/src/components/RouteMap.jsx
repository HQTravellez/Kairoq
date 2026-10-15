import { motion } from 'framer-motion';

// Animated flight routes over a dotted world, drawn in SVG (decorative only).
const CITIES = { lon: [455, 150], lis: [430, 205], nyc: [250, 185], tor: [245, 160], dxb: [610, 235], sin: [745, 315], tyo: [835, 190], sfo: [130, 195], cpt: [510, 410], syd: [860, 420] };
const ROUTES = [['lon', 'nyc'], ['lis', 'tor'], ['lon', 'dxb'], ['dxb', 'sin'], ['sin', 'tyo'], ['nyc', 'sfo'], ['lon', 'cpt'], ['sin', 'syd']];
function arc([x1, y1], [x2, y2]) { const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.28 - 20; return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`; }
// A coarse dot grid shaped roughly like the continents.
const LAND = [[90, 140, 300, 230], [220, 240, 300, 420], [420, 120, 560, 220], [450, 230, 600, 430], [560, 120, 880, 280], [780, 360, 900, 450]];
const DOTS = [];
for (const [x0, y0, x1, y1] of LAND) for (let x = x0; x <= x1; x += 14) for (let y = y0; y <= y1; y += 14) if (((x * 7 + y * 13) % 5) !== 0) DOTS.push([x, y]);

export default function RouteMap({ className = '' }) {
  return (
    <svg viewBox="60 90 880 380" className={className} role="img" aria-label="Flight routes between cities">
      <defs>
        <linearGradient id="route" x1="0" x2="1"><stop offset="0" stopColor="#5eead4" /><stop offset="1" stopColor="#a5b4fc" /></linearGradient>
        <radialGradient id="glow"><stop offset="0" stopColor="#fcd34d" stopOpacity="0.9" /><stop offset="1" stopColor="#fcd34d" stopOpacity="0" /></radialGradient>
      </defs>
      {DOTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="white" opacity="0.18" />)}
      {ROUTES.map(([a, b], i) => (
        <g key={a + b}>
          <path d={arc(CITIES[a], CITIES[b])} fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="2" />
          <motion.path d={arc(CITIES[a], CITIES[b])} fill="none" stroke="url(#route)" strokeWidth="2" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 4.5, delay: i * 0.6, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }} />
        </g>
      ))}
      {Object.entries(CITIES).map(([k, [x, y]]) => (
        <g key={k}>
          <circle cx={x} cy={y} r="10" fill="url(#glow)" />
          <circle cx={x} cy={y} r="3" fill="#fde68a" />
        </g>
      ))}
    </svg>
  );
}
