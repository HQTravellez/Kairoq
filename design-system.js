'use strict';
const palettes={
 editorial:{paper:'#f5f2eb',surface:'#ffffff',ink:'#202a2b',muted:'#516260',accent:'#225b52',onAccent:'#ffffff',border:'#cad3cc',heading:'Georgia,serif'},
 luxury:{paper:'#f4f0e8',surface:'#fffdf8',ink:'#292820',muted:'#626052',accent:'#635037',onAccent:'#ffffff',border:'#d8d0c1',heading:'Georgia,serif'},
 tech:{paper:'#f2f5fa',surface:'#ffffff',ink:'#182637',muted:'#506276',accent:'#205bb3',onAccent:'#ffffff',border:'#c8d4e2',heading:'ui-sans-serif,system-ui,sans-serif'},
 playful:{paper:'#fff8ee',surface:'#ffffff',ink:'#26363a',muted:'#53656a',accent:'#006b68',onAccent:'#ffffff',border:'#c6d9d3',heading:'ui-rounded,system-ui,sans-serif'},
 minimal:{paper:'#f5f5f3',surface:'#ffffff',ink:'#232323',muted:'#5e5e5e',accent:'#252525',onAccent:'#ffffff',border:'#cececa',heading:'ui-sans-serif,system-ui,sans-serif'}
};
function foundation(style='editorial'){
 const p=palettes[style]||palettes.editorial;
 return `/* Kairoq reusable UI foundation v1; project styles may customize these tokens. */
:root{--kq-paper:${p.paper};--kq-surface:${p.surface};--kq-ink:${p.ink};--kq-muted:${p.muted};--kq-accent:${p.accent};--kq-on-accent:${p.onAccent};--kq-border:${p.border};--kq-heading:${p.heading};--kq-body:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--kq-radius:10px;--kq-space:8px}
.kq-page{margin:0;background:var(--kq-paper);color:var(--kq-ink);font:16px/1.55 var(--kq-body)}
.kq-shell{width:min(1200px,100% - 48px);margin-inline:auto}.kq-heading{font-family:var(--kq-heading);line-height:1.12;letter-spacing:-.035em}.kq-muted{color:var(--kq-muted)}
.kq-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:11px 18px;border:1px solid transparent;border-radius:var(--kq-radius);background:var(--kq-accent);color:var(--kq-on-accent);font:600 15px/1.3 var(--kq-body);cursor:pointer;text-decoration:none}.kq-button--secondary{background:var(--kq-surface);color:var(--kq-ink);border-color:var(--kq-border)}.kq-button:disabled{opacity:.6;cursor:default}
.kq-input{width:100%;min-height:44px;padding:11px 13px;border:1px solid var(--kq-border);border-radius:var(--kq-radius);background:var(--kq-surface);color:var(--kq-ink);font:16px/1.4 var(--kq-body)}.kq-label{display:block;margin-bottom:8px;font:600 13px/1.4 var(--kq-body)}
.kq-panel{padding:24px;background:var(--kq-surface);border:1px solid var(--kq-border);border-radius:var(--kq-radius)}.kq-stack{display:grid;gap:24px}.kq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:24px}.kq-nav{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.kq-table-wrap{max-width:100%;overflow:auto}.kq-table{width:100%;border-collapse:collapse;text-align:left}.kq-table th,.kq-table td{padding:14px 16px;border-bottom:1px solid var(--kq-border);vertical-align:top}.kq-table th{font-size:13px;color:var(--kq-muted)}
.kq-empty{padding:40px 24px;max-width:600px}.kq-status{padding:12px 16px;border-left:3px solid var(--kq-accent);background:var(--kq-surface)}.kq-sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.kq-page :focus-visible{outline:3px solid var(--kq-accent);outline-offset:3px}.kq-page img,.kq-page svg{max-width:100%}.kq-page input,.kq-page textarea,.kq-page select{font-size:16px}
@media(max-width:600px){.kq-shell{width:calc(100% - 32px)}.kq-panel{padding:18px}.kq-table th,.kq-table td{padding:12px}.kq-heading{overflow-wrap:anywhere}}
@media(prefers-reduced-motion:reduce){.kq-page *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}`;
}
function apply(files,style){return {...files,'styles.css':foundation(style)+'\n/* END KAIROQ FOUNDATION */\n'+String(files['styles.css']).replace(/\/\* Kairoq reusable UI foundation v1[\s\S]*?\/\* END KAIROQ FOUNDATION \*\/\n?/g,'')};}
module.exports={palettes,foundation,apply};
