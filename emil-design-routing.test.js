import test from 'node:test';
import assert from 'node:assert/strict';
import {selectEngineeringWorkflow} from './engineering-skill-router.js';
test('design tasks select visual quality and edge-case checks',()=>{const r=selectEngineeringWorkflow('Redesign responsive dashboard UI');assert.ok(r.skills.includes('emil-design-eng'));assert.ok(r.gates.includes('edge-case-ui'));});
test('animation tasks select motion performance and accessibility',()=>{const r=selectEngineeringWorkflow('Improve animation transitions');assert.equal(r.kind,'motion-quality');assert.ok(r.skills.includes('animation-performance'));assert.ok(r.gates.includes('reduced-motion'));});
