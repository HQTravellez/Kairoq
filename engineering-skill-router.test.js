import test from 'node:test';
import assert from 'node:assert/strict';
import { selectEngineeringWorkflow } from './engineering-skill-router.js';
test('routes API implementation with verification gates', () => {
 const result=selectEngineeringWorkflow('Integrate hotel API and generate SDK');
 assert.equal(result.kind,'api-integration');
 assert.ok(result.gates.includes('integration-tests'));
});
test('routes bugs to diagnosis and regression tests', () => {
 const result=selectEngineeringWorkflow('Fix broken login error');
 assert.equal(result.kind,'bug-fix');
 assert.ok(result.skills.includes('diagnosing-bugs'));
});
test('routes visual design to mobile QA', () => {
 const result=selectEngineeringWorkflow('Improve responsive UI design');
 assert.equal(result.kind,'ui-design');
 assert.ok(result.gates.includes('mobile-visual-qa'));
});
test('routes complex builds to specs and tickets', () => {
 const result=selectEngineeringWorkflow('Build a travel platform');
 assert.equal(result.kind,'app-build');
 assert.ok(result.skills.includes('to-tickets'));
});
test('asks for clarification on empty request', () => {
 assert.equal(selectEngineeringWorkflow(' ').kind,'clarify');
});
