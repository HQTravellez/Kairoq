"use strict";
// The live browser in the editor's third pane: the real Chromium screen, streamed as it moves.
// Kairoq's research pages show here while it reads them (it "drives"); when it is done the owner
// can use the same browser by hand: type an address, go back and forward, click, type, scroll.
// One live browser per account. Frames come from Chrome's screencast (CDP), so the pane shows
// the page loading and scrolling, not one still picture per page.

const runtime = require('./runtime-check');

const IDLE_MS = 10 * 60_000;      // a hand-driven browser closes after 10 quiet minutes
const FRAME_MS = 120;             // at most ~8 pictures a second per viewer
const states = new Map();         // owner -> state

function state(owner) {
  let s = states.get(owner);
  if (!s) {
    s = { page: null, cdp: null, session: null, frame: '', width: 1280, height: 800,
      url: '', title: '', loading: false, driver: null, viewers: new Set(), idle: null, size: null };
    states.set(owner, s);
  }
  return s;
}

function snapshot(s, withFrame) {
  return { url: s.url, title: s.title, loading: s.loading, driver: s.driver,
    width: s.width, height: s.height, ...(withFrame && s.frame ? { frame: s.frame } : {}) };
}

function emit(s, withFrame) {
  for (const v of s.viewers) v.push(withFrame);
}

async function stopWatching(s) {
  const cdp = s.cdp;
  s.cdp = null;
  if (cdp) await cdp.send('Page.stopScreencast').catch(() => {});
  if (cdp) await cdp.detach().catch(() => {});
}

async function closeHandSession(s) {
  const sess = s.session;
  s.session = null;
  if (sess) await sess.close().catch(() => {});
}

// Start streaming a page. `driver` is 'kairoq' while it researches, 'you' when the owner drives.
async function watch(owner, page, driver = 'kairoq') {
  const s = state(owner);
  if (s.page === page) return;
  await stopWatching(s);
  if (driver === 'kairoq') await closeHandSession(s);
  s.page = page;
  s.driver = driver;
  s.loading = true;
  emit(s, false);

  const refresh = async () => {
    if (s.page !== page) return;
    s.url = page.url();
    s.title = await page.title().catch(() => s.title);
    emit(s, false);
  };
  page.on('framenavigated', f => { if (f === page.mainFrame()) { s.loading = true; refresh(); } });
  page.on('load', () => { s.loading = false; refresh(); });
  page.on('close', () => {
    if (s.page !== page) return;
    s.page = null;
    s.cdp = null;
    s.loading = false;
    if (s.driver === 'kairoq') s.driver = null;
    emit(s, false);
  });

  // The page is laid out at the pane's own size, so it reads like a real browser, not a shrunk desktop.
  if (s.size) await page.setViewportSize(s.size).catch(() => {});
  try {
    const cdp = await page.context().newCDPSession(page);
    s.cdp = cdp;
    cdp.on('Page.screencastFrame', f => {
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
      if (s.page !== page) return;
      s.frame = f.data;
      if (f.metadata) {
        s.width = Math.round(f.metadata.deviceWidth) || s.width;
        s.height = Math.round(f.metadata.deviceHeight) || s.height;
      }
      emit(s, true);
    });
    const w = s.size ? s.size.width : 1280, h = s.size ? s.size.height : 800;
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: w * 2, maxHeight: h * 2, everyNthFrame: 1 });
  } catch { /* the page closed before streaming started */ }
}

// A viewer (Server-Sent Events): the current state at once, then changes and new frames.
function stream(owner, req, res) {
  const s = state(owner);
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store',
    'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
  let pending = false, pendingFrame = false, timer = null, lastFrameAt = 0;
  const write = () => {
    timer = null;
    const withFrame = pendingFrame;
    pending = pendingFrame = false;
    if (withFrame) lastFrameAt = Date.now();
    res.write('data: ' + JSON.stringify(snapshot(s, withFrame)) + '\n\n');
  };
  const viewer = {
    push(withFrame) {
      pending = true;
      pendingFrame = pendingFrame || withFrame;
      if (timer) return;
      const wait = pendingFrame ? Math.max(0, FRAME_MS - (Date.now() - lastFrameAt)) : 0;
      timer = setTimeout(write, wait);
    }
  };
  s.viewers.add(viewer);
  viewer.push(true);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  ping.unref?.();
  req.on('close', () => { s.viewers.delete(viewer); clearInterval(ping); if (timer) clearTimeout(timer); });
}

function touch(owner, s) {
  if (s.idle) clearTimeout(s.idle);
  s.idle = setTimeout(() => { closeHandSession(s).then(() => { s.driver = null; emit(s, false); }); }, IDLE_MS);
  s.idle.unref?.();
}

function fail(message, status = 400) { return Object.assign(Error(message), { status }); }

// Open an address for the owner (a fresh, guarded browser: public https sites only).
async function go(owner, raw) {
  const s = state(owner);
  if (s.driver === 'kairoq' && s.page) throw fail('Kairoq is using the browser. It will be yours in a moment.', 409);
  let text = String(raw || '').trim();
  if (!text) throw fail('Type an address');
  if (!/^https?:\/\//i.test(text)) {
    text = /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(text) ? 'https://' + text
      : 'https://duckduckgo.com/?q=' + encodeURIComponent(text);
  }
  const url = await runtime.checkSite(text);
  await closeHandSession(s);
  s.url = url; s.loading = true; s.driver = 'you'; emit(s, false);
  const sess = await runtime.session(url, { site: true, onPage: p => watch(owner, p, 'you') });
  if (!sess) throw fail('The browser is not available on this server', 503);
  sess.control.start();
  s.session = sess;
  touch(owner, s);
  return snapshot(s, false);
}

// The pane's size in CSS pixels: pages open (and the open page re-lays out) at that size.
async function resize(owner, ev) {
  const s = state(owner);
  const width = Math.round(Number(ev.width)), height = Math.round(Number(ev.height));
  if (!(width >= 320 && width <= 2000 && height >= 300 && height <= 2000)) throw fail('Unusual browser size');
  s.size = { width, height };
  if (s.page) {
    const page = s.page;
    await page.setViewportSize(s.size).catch(() => {});
    if (s.cdp) {
      await s.cdp.send('Page.stopScreencast').catch(() => {});
      await s.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: width * 2, maxHeight: height * 2, everyNthFrame: 1 }).catch(() => {});
    }
  }
  return snapshot(s, false);
}

// The owner's clicks, typing, keys and scrolling, in page pixels.
async function input(owner, ev = {}) {
  const s = state(owner);
  if (ev.type === 'size') return resize(owner, ev);
  if (ev.type === 'go') return go(owner, ev.url);
  if (s.driver === 'kairoq' && s.page) throw fail('Kairoq is using the browser. It will be yours in a moment.', 409);
  if (!s.session) {
    if (!s.url) throw fail('Type an address first');
    await go(owner, s.url);
  }
  const page = s.page;
  touch(owner, s);
  if (ev.type === 'back') await page.goBack({ timeout: 15000 }).catch(() => {});
  else if (ev.type === 'forward') await page.goForward({ timeout: 15000 }).catch(() => {});
  else if (ev.type === 'reload') await page.reload({ timeout: 15000 }).catch(() => {});
  else await s.session.control.input(ev);
  // A click can change the tab title or address without a page load (single-page sites).
  if (s.page === page) {
    s.url = page.url();
    s.title = await page.title().catch(() => s.title);
    emit(s, false);
  }
  return snapshot(s, false);
}

module.exports = { watch, stream, input, go, _states: states };
