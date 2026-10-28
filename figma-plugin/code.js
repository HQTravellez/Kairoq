// Kairoq for Figma: rebuilds a page sent from Kairoq (figma-export.js) as editable Figma layers.
// Each frame is placed side by side; boxes become rectangles, text becomes text layers in the
// page's fonts (Inter when a font is not available), images become image fills, icons become vectors.
figma.showUI(__html__, { width: 340, height: 250 });

const STYLES = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
const loaded = new Map();
async function fontFor(family, weight, italic) {
  const w = Math.min(900, Math.max(100, Math.round((weight || 400) / 100) * 100));
  const style = STYLES[w] + (italic ? ' Italic' : '');
  family = String(family || 'Inter').replace(/ Variable$/, '');
  const tries = [{ family, style }, { family, style: style.replace(' ', '') }, { family, style: italic ? 'Italic' : 'Regular' }, { family: 'Inter', style }, { family: 'Inter', style: 'Regular' }];
  for (const f of tries) {
    const key = f.family + '|' + f.style;
    if (loaded.has(key)) { if (loaded.get(key)) return f; continue; }
    try { await figma.loadFontAsync(f); loaded.set(key, true); return f; } catch (e) { loaded.set(key, false); }
  }
  return { family: 'Inter', style: 'Regular' };
}
const solid = (c) => (c ? [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a === undefined ? 1 : c.a }] : []);
function shadowEffect(css) {
  const m = /(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px(?:\s+(-?\d+(?:\.\d+)?)px)?/.exec(css || '');
  if (!m) return [];
  const c = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(css) || [0, 0, 0, 0, 0.15];
  return [{ type: 'DROP_SHADOW', color: { r: c[1] / 255, g: c[2] / 255, b: c[3] / 255, a: c[4] === undefined ? 1 : +c[4] }, offset: { x: +m[1], y: +m[2] }, radius: +m[3], spread: +(m[4] || 0), visible: true, blendMode: 'NORMAL' }];
}
function imageFill(b64, fit) {
  const img = figma.createImage(figma.base64Decode(b64));
  return [{ type: 'IMAGE', imageHash: img.hash, scaleMode: fit === 'contain' ? 'FIT' : 'FILL' }];
}

async function buildFrame(f, x) {
  const frame = figma.createFrame();
  frame.name = f.name;
  frame.resize(Math.max(1, f.width), Math.max(1, f.height));
  frame.x = x; frame.y = 0;
  frame.fills = solid(f.background);
  frame.clipsContent = true;
  let count = 0;
  for (const n of f.nodes) {
    try {
      let node = null;
      if (n.t === 'box' || (n.t === 'image')) {
        node = figma.createRectangle();
        node.name = n.t === 'image' ? 'Image' : (n.name || 'Box');
        node.resize(Math.max(1, n.w), Math.max(1, n.h));
        node.fills = n.data ? imageFill(n.data, n.fit) : n.t === 'image' ? solid({ r: 0.9, g: 0.9, b: 0.92, a: 1 }) : solid(n.fill);
        if (n.stroke && n.strokeWidth) { node.strokes = solid(n.stroke); node.strokeWeight = n.strokeWidth; node.strokeAlign = 'INSIDE'; }
        if (n.radius) node.cornerRadius = Math.min(n.radius, Math.min(n.w, n.h) / 2);
        if (n.shadow) node.effects = shadowEffect(n.shadow);
      } else if (n.t === 'svg') {
        node = figma.createNodeFromSvg(n.svg);
        node.name = 'Icon';
        if (node.width > 0 && node.height > 0) node.rescale(Math.max(0.01, n.w / node.width));
      } else if (n.t === 'text') {
        node = figma.createText();
        const font = await fontFor(n.font, n.weight, n.italic);
        node.fontName = font;
        node.characters = n.transform === 'uppercase' ? n.text.toUpperCase() : n.text;
        node.fontSize = Math.max(1, n.size || 16);
        if (n.lineHeight) node.lineHeight = { value: n.lineHeight, unit: 'PIXELS' };
        if (n.letterSpacing) node.letterSpacing = { value: n.letterSpacing, unit: 'PIXELS' };
        node.fills = solid(n.color);
        node.textAlignHorizontal = n.align === 'center' ? 'CENTER' : n.align === 'right' || n.align === 'end' ? 'RIGHT' : 'LEFT';
        node.textAutoResize = 'HEIGHT';
        node.resize(Math.max(1, n.w + 2), Math.max(1, n.h));
        node.name = n.text.slice(0, 40);
      }
      if (!node) continue;
      node.x = n.x; node.y = n.y;
      if (n.opacity !== undefined && n.opacity < 1) node.opacity = n.opacity;
      frame.appendChild(node);
      count++;
    } catch (e) { /* one odd layer never stops the page */ }
  }
  return { frame, count };
}

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'build') return;
  try {
    const data = msg.data, made = [];
    let x = Math.round(figma.viewport.center.x), layers = 0;
    for (const f of data.frames) { const r = await buildFrame(f, x); made.push(r.frame); layers += r.count; x += f.width + 120; }
    figma.currentPage.selection = made;
    figma.viewport.scrollAndZoomIntoView(made);
    figma.ui.postMessage({ type: 'done', layers });
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: 'Could not build the page: ' + (e && e.message || e) });
  }
};
