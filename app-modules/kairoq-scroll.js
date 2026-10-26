// kairoq/scroll: scroll-driven film sections for generated apps.
//
// <ScrollVideo src="./uploads/explode-1a2b3c4d5e6f/" frames={96} />
//   A tall, full-width section that stays pinned while the visitor scrolls through it and plays a
//   film frame by frame with the scroll, forwards and backwards (the technique Apple uses for
//   product pages). The frames are numbered WebP images (001.webp, 002.webp, ...) that Kairoq
//   makes from a product explode film. By default the film plays to its end in the middle of the
//   section and back again ("there-and-back"), so the product comes apart and assembles again.
//
// Props: src (folder of frames), frames (how many), screens (section height in screens, default 3),
//   mode "there-and-back" (default) | "once" (default for layout="split"), captions [{ title, text }] shown one after another,
//   tone "dark" | "light" (the stage colour around the film), fit "contain" | "cover", alt.
// layout="split": a scene beside a headline (title, text and a cta button { label, href }), on the
//   page's own background (bg-background, the colour Kairoq made the film's backdrop in); on phones
//   the text sits above the film. side="right" puts the film on the left.
// People who prefer reduced motion see the last frame with all captions (or the scene's text).
import React, { useEffect, useMemo, useRef, useState } from 'react';

const h = React.createElement;
// The film's edges fade into the page, so a scene never looks like a box pasted on it.
const FADE = 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 68%, transparent 100%)';
const pad = (n) => String(n).padStart(3, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function prefersStill() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
// Where the film is (0..1) for a scroll progress (0..1).
export function filmAt(p, mode) {
  if (mode === 'once') return clamp(p, 0, 1);
  // Apart in the middle: plays to the end by 45%, holds until 55%, back to the start at 100%.
  if (p < 0.45) return p / 0.45;
  if (p < 0.55) return 1;
  return clamp(1 - (p - 0.55) / 0.45, 0, 1);
}

export function ScrollVideo({ src, frames = 96, screens = 3, mode: modeProp, captions = [], tone = 'dark', fit = 'contain', alt = 'Product film', className = '', layout = 'full', title, text, cta, side = 'left' }) {
  const base = String(src || '').replace(/\/?$/, '/');
  const count = Math.max(2, Math.min(400, Math.round(Number(frames) || 0)));
  const url = (i) => base + pad(i + 1) + '.webp';
  const section = useRef(null), canvas = useRef(null);
  const images = useRef([]), shown = useRef(-1), want = useRef(0);
  const [progress, setProgress] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const [broken, setBroken] = useState(false);
  const [still] = useState(prefersStill);
  const split = layout === 'split';
  // A scene plays once through its section; a full-width film plays there and back.
  const mode = modeProp || (split ? 'once' : 'there-and-back');
  const [wide, setWide] = useState(() => { try { return window.matchMedia('(min-width: 768px)').matches; } catch { return true; } });
  useEffect(() => { if (!split) return; let m; try { m = window.matchMedia('(min-width: 768px)'); } catch { return; } const on = () => setWide(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, [split]);
  const stage = tone === 'light' ? '#f4f4f2' : '#0b0b0c', ink = tone === 'light' ? '#111' : '#f5f5f4';
  // A split scene sits on the page's own background, which is also the film's backdrop.
  const fill = () => { if (!split) return stage; try { const c = getComputedStyle(section.current).backgroundColor; return c && c !== 'rgba(0, 0, 0, 0)' ? c : stage; } catch { return stage; } };

  // Draws the nearest loaded frame to the one wanted.
  const draw = () => {
    const c = canvas.current; if (!c) return;
    const target = want.current; let i = target;
    for (let d = 0; d < count; d++) {
      for (const j of [target - d, target + d]) if (j >= 0 && j < count && images.current[j] && images.current[j].complete && images.current[j].naturalWidth) { i = j; d = count; break; }
    }
    const img = images.current[i];
    if (!img || !img.naturalWidth || (i === shown.current && c.dataset.size === c.width + 'x' + c.height)) return;
    const ctx = c.getContext('2d'), W = c.width, H = c.height;
    const sc = fit === 'cover' ? Math.max(W / img.naturalWidth, H / img.naturalHeight) : Math.min(Math.max(W / img.naturalWidth, H / img.naturalHeight), Math.min(W / img.naturalWidth, H / img.naturalHeight) * 1.5);
    const w = img.naturalWidth * sc, hh = img.naturalHeight * sc;
    ctx.fillStyle = fill(); ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, (W - w) / 2, (H - hh) / 2, w, hh);
    shown.current = i; c.dataset.size = W + 'x' + H; c.dataset.kqFrame = String(i);
    if (!drawn) setDrawn(true);
  };

  // Loads the frames: the first at once, then spread out (every 8th, every 4th...) so any scroll
  // position soon has a near frame.
  useEffect(() => {
    if (still) return;
    let gone = false;
    const order = [], seen = new Set();
    for (const step of [count, 16, 8, 4, 2, 1]) for (let i = 0; i < count; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    images.current = new Array(count);
    let next = 0, active = 0;
    const pump = () => {
      while (!gone && active < 6 && next < order.length) {
        const i = order[next++], img = new Image();
        active++; img.decoding = 'async';
        img.onload = () => { active--; if (!gone) { draw(); pump(); } };
        img.onerror = () => { active--; if (i === 0 && !gone) setBroken(true); pump(); };
        img.src = url(i); images.current[i] = img;
      }
    };
    pump();
    return () => { gone = true; };
  }, [base, count, still]);

  // Scroll and size.
  useEffect(() => {
    if (still) return;
    let raf = 0;
    const fitCanvas = () => {
      const c = canvas.current; if (!c) return;
      const r = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(c.clientWidth * r); c.height = Math.round(c.clientHeight * r);
      shown.current = -1;
    };
    const tick = () => {
      raf = 0;
      const el = section.current; if (!el) return;
      const rect = el.getBoundingClientRect(), span = Math.max(1, el.offsetHeight - window.innerHeight);
      const p = clamp(-rect.top / span, 0, 1);
      want.current = Math.round(filmAt(p, mode) * (count - 1));
      setProgress(p); draw();
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const resize = () => { fitCanvas(); ask(); };
    fitCanvas(); tick();
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', ask); window.removeEventListener('resize', resize); };
  }, [count, mode, still, wide]);

  const list = Array.isArray(captions) ? captions.filter((c) => c && (c.title || c.text)).slice(0, 6) : [];
  const caption = list.length ? Math.min(list.length - 1, Math.floor(progress * list.length)) : -1;
  const label = { position: 'absolute', left: 'clamp(16px, 5vw, 64px)', bottom: 'clamp(28px, 8vh, 80px)', maxWidth: 'min(420px, 80vw)', color: ink };

  const words = split ? h('div', { 'data-kq-scene-text': '', style: { maxWidth: 520 } },
    title ? h('h2', { className: 'font-display', style: { margin: 0, fontSize: 'clamp(2.5rem, 5.5vw, 4.75rem)', lineHeight: 1.02, fontWeight: 500, letterSpacing: '-0.02em' } }, title) : null,
    text ? h('p', { style: { margin: '18px 0 0', fontSize: '1.0625rem', lineHeight: 1.6, opacity: 0.72, maxWidth: 440 } }, text) : null,
    cta && cta.label ? h('a', { href: cta.href || '#', className: 'bg-primary text-primary-foreground', style: { display: 'inline-block', marginTop: 28, padding: '12px 22px', borderRadius: 999, fontWeight: 600, textDecoration: 'none' } }, cta.label) : null) : null;
  if (split && still) {
    return h('section', { className: 'bg-background text-foreground ' + className, 'data-kq-scroll-video': '', style: { display: 'grid', gridTemplateColumns: wide ? 'minmax(0,5fr) minmax(0,7fr)' : '1fr', alignItems: 'center', gap: 32, padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 64px)' } },
      h('div', { style: { order: wide && side === 'right' ? 2 : 0 } }, words),
      h('img', { src: url(count - 1), alt, style: { width: '100%', display: 'block' }, 'data-kq-drawn': 'true' }));
  }
  if (split) {
    return h('section', { ref: section, className: 'bg-background text-foreground ' + className, 'data-kq-scroll-video': '', style: { position: 'relative', height: Math.max(1.5, Number(screens) || 2.5) * 100 + 'vh' } },
      h('div', { 'data-kq-scene': '', style: { position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'grid', gridTemplateColumns: wide ? 'minmax(0,5fr) minmax(0,7fr)' : '1fr', gridTemplateRows: wide ? '1fr' : 'auto auto', alignItems: 'center', alignContent: 'center', gap: wide ? 32 : 20, padding: wide ? '0 clamp(24px, 5vw, 72px)' : '0 20px' } },
        h('div', { style: { order: wide && side === 'right' ? 2 : 0 } }, words),
        h('canvas', { ref: canvas, role: 'img', 'aria-label': alt, 'data-kq-drawn': drawn ? 'true' : 'false', style: { width: '100%', height: wide ? '78vh' : 'min(56vh, 110vw)', minHeight: 0, display: 'block', opacity: drawn ? 1 : 0, transition: 'opacity .6s ease', WebkitMaskImage: FADE, maskImage: FADE } }),
        broken ? h('p', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.6, margin: 0 } }, alt) : null));
  }
  if (still) {
    return h('section', { className, 'data-kq-scroll-video': '', style: { background: stage, color: ink } },
      h('img', { src: url(count - 1), alt, style: { display: 'block', width: '100%', maxHeight: '80vh', objectFit: 'contain' }, 'data-kq-drawn': 'true' }),
      list.length ? h('div', { style: { display: 'grid', gap: 16, padding: 'clamp(16px, 5vw, 64px)', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' } },
        list.map((c, i) => h('div', { key: i }, c.title && h('h3', { style: { margin: 0, fontSize: '1.125rem', fontWeight: 600 } }, c.title), c.text && h('p', { style: { margin: '6px 0 0', opacity: 0.75 } }, c.text)))) : null);
  }
  return h('section', { ref: section, className, 'data-kq-scroll-video': '', style: { position: 'relative', height: Math.max(1.5, Number(screens) || 3) * 100 + 'vh', background: stage } },
    h('div', { 'data-kq-scene': '', style: { position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', background: stage } },
      h('canvas', { ref: canvas, role: 'img', 'aria-label': alt, 'data-kq-drawn': drawn ? 'true' : 'false', style: { width: '100%', height: '100%', display: 'block', opacity: drawn ? 1 : 0, transition: 'opacity .6s ease' } }),
      // A soft shade at the bottom so captions read on any frame.
      list.length ? h('div', { 'aria-hidden': 'true', style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%', pointerEvents: 'none', background: 'linear-gradient(to top, ' + (tone === 'light' ? 'rgba(244,244,242,.85)' : 'rgba(11,11,12,.78)') + ', transparent)' } }) : null,
      broken ? h('p', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: ink, opacity: 0.6, margin: 0 } }, alt) : null,
      list.map((c, i) => h('div', { key: i, 'data-kq-caption': '', 'aria-hidden': i === caption ? undefined : 'true', style: { ...label, opacity: i === caption ? 1 : 0, transform: i === caption ? 'none' : 'translateY(12px)', transition: 'opacity .5s ease, transform .5s ease' } },
        c.title && h('h3', { style: { margin: 0, fontSize: 'clamp(1.25rem, 2.4vw, 2rem)', fontWeight: 600, letterSpacing: '-0.01em' } }, c.title),
        c.text && h('p', { style: { margin: '8px 0 0', opacity: 0.72, lineHeight: 1.5 } }, c.text))),
      h('div', { 'aria-hidden': 'true', style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: tone === 'light' ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.1)' } },
        h('div', { style: { height: '100%', width: (progress * 100).toFixed(2) + '%', background: ink, opacity: 0.6 } }))));
}
