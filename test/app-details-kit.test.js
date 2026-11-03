'use strict';
// Apps come out with the small details: number fields with their unit and quick picks, a −/+
// stepper, a segmented switch, one live result with Reset, and money formatted properly. The
// pieces ship in every new project's UI kit and the builder is told when to use them.
const test=require('node:test'),assert=require('node:assert/strict');
const design=require('../react-design'),docs=require('../ui-kit-docs');

test('the kit ships the pieces and the builder knows their API',()=>{
 const kit=design.kit();
 for(const f of ['src/components/ui/number-field.jsx','src/components/ui/segmented.jsx','src/components/ui/result-panel.jsx','src/lib/format.js']){
  assert.ok(kit[f],f+' is in the starter kit');assert.ok(design.KIT_API[f],f+' has a one-line API');
 }
 assert.match(kit['src/components/ui/number-field.jsx'],/export function NumberField\(/);
 assert.match(kit['src/components/ui/number-field.jsx'],/export function Stepper\(/);
 assert.match(kit['src/components/ui/number-field.jsx'],/aria-pressed=\{on\}/,'the picked preset is announced');
 assert.match(kit['src/components/ui/segmented.jsx'],/role="radiogroup"/);
 assert.match(kit['src/components/ui/segmented.jsx'],/minmax\(max-content, 1fr\)/,'labels never wrap or cut on phones');
 assert.match(kit['src/components/ui/result-panel.jsx'],/aria-live="polite"/);
 assert.doesNotMatch(kit['src/components/ui/number-field.jsx'],/id \|\| React\.useId\(\)/,'hooks are not called conditionally');
});

test('formatMoney formats money the way people read it',async()=>{
 const src=design.kit()['src/lib/format.js'];
 const mod=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
 assert.equal(mod.formatMoney(27.5),'$27.50');
 assert.equal(mod.formatMoney(NaN),'—');
 assert.equal(mod.formatNumber(1234.5),'1,234.5');
 assert.equal(mod.formatPercent(15),'15%');
});

test('the design rules say when to use them',()=>{
 assert.match(design.RULES,/Numbers, calculators and quotes/);
 assert.match(design.RULES,/quick-pick presets/);assert.match(design.RULES,/no Calculate button/);
 const note=docs.note(['src/components/ui/number-field.jsx','src/components/ui/result-panel.jsx'],design.KIT_API);
 assert.match(note,/presets=\{\[10, 15, 18, 20, 25\]\}/);assert.match(note,/A Calculate button \(update live\)/);
});
