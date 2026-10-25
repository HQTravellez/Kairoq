'use strict';
// The "also changed sign-in / payments / saved data" warning: real side effects are reported;
// code that only moved into new, smaller files is not.
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../scope-guard');

test('splitting a component that holds sign-in code is not reported as changing sign-in',()=>{
 const panel="import { auth } from 'kairoq';\nexport default function OwnerMenuPanel() {\n  const user = auth.user();\n  async function signIn(e) { await auth.signIn(email, password); }\n  return <div />;\n}\n";
 const after={
  'src/components/menu/OwnerMenuPanel.jsx':"import OwnerSignInForm from './OwnerSignInForm.jsx';\nexport default function OwnerMenuPanel() {\n  return <div />;\n}\n",
  'src/components/menu/OwnerSignInForm.jsx':"// Owner sign-in form.\nimport { auth } from 'kairoq';\nexport default function OwnerSignInForm() {\n    const user = auth.user();\n    async function signIn(e) { await auth.signIn(email, password); }\n}\n"};
 assert.deepEqual(G.check('Rebuild the site and split the owner controls into smaller components',{'src/components/menu/OwnerMenuPanel.jsx':panel},after),[]);
});

test('real side effects are still reported',()=>{
 assert.deepEqual(G.check('make the menu blue',{'src/pages/MenuPage.jsx':'x'},{'src/pages/MenuPage.jsx':'x\nawait auth.signOut();'}).map(f=>f.area),['sign-in']);
 assert.deepEqual(G.check('make the menu blue',{},{'sql/002_prices.sql':'alter table menu add column price int;'}).map(f=>f.area),['saved data and bookings']);
 assert.deepEqual(G.check('make the menu blue',{'src/pages/P.jsx':''},{'src/pages/P.jsx':'await payments.checkout("price_1Abcdefg")'}).map(f=>f.area),['payments']);
});
