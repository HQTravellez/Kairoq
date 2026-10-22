// Deterministic, dependency-free engineering skill selector.
// This module proposes workflows; it never executes third-party instructions.
const RULES = [
  { id: 'api-integration', terms: [/\bapi\b/i,/openapi/i,/swagger/i,/\bsdk\b/i,/oauth/i,/integration/i,/endpoint/i], skills: ['to-spec','implement-spec','tdd','code-review'], gates: ['api-contract','auth-permissions','integration-tests'] },
  { id: 'bug-fix', terms: [/\bbug\b/i,/\bfix\b/i,/broken/i,/failing/i,/error/i,/crash/i,/regression/i], skills: ['diagnosing-bugs','tdd','code-review'], gates: ['reproduction','regression-tests'] },
  { id: 'ui-design', terms: [/\bui\b/i,/\bux\b/i,/design/i,/responsive/i,/layout/i,/visual/i,/chakra/i], skills: ['to-spec','implement','code-review'], gates: ['desktop-visual-qa','mobile-visual-qa','accessibility'] },
  { id: 'architecture', terms: [/architecture/i,/refactor/i,/scalab/i,/codebase/i], skills: ['improve-codebase-architecture','code-review'], gates: ['existing-tests','regression-tests'] },
  { id: 'app-build', terms: [/\bbuild\b/i,/\bcreate\b/i,/\bapp\b/i,/\bwebsite\b/i,/\bplatform\b/i,/\bfeature\b/i], skills: ['to-spec','to-tickets','implement-spec','tdd','code-review'], gates: ['unit-tests','integration-tests','browser-qa'] }
];
export function selectEngineeringWorkflow(request) {
  if (typeof request !== 'string' || !request.trim()) return { kind:'clarify', skills:[], gates:[], matched:[] };
  const matched = RULES.filter(rule => rule.terms.some(re => re.test(request)));
  if (!matched.length) return { kind:'clarify', skills:['grill-with-docs'], gates:[], matched:[] };
  const priority = ['api-integration','bug-fix','ui-design','architecture','app-build'];
  const primary = priority.find(id => matched.some(rule => rule.id === id));
  return { kind:primary, skills:[...new Set(matched.flatMap(rule=>rule.skills))], gates:[...new Set(matched.flatMap(rule=>rule.gates))], matched:matched.map(rule=>rule.id) };
}
