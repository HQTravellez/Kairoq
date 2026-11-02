const test=require('node:test'),assert=require('node:assert/strict');
const {atProjectCap}=require('../create-api');
test('no project cap by default, even past 50',()=>{delete process.env.KAIROQ_BUILDER_MAX_PROJECTS;assert.equal(atProjectCap(50),false);assert.equal(atProjectCap(5000),false)});
test('KAIROQ_BUILDER_MAX_PROJECTS still sets a cap when given',()=>{process.env.KAIROQ_BUILDER_MAX_PROJECTS='10';assert.equal(atProjectCap(9),false);assert.equal(atProjectCap(10),true);process.env.KAIROQ_BUILDER_MAX_PROJECTS='0';assert.equal(atProjectCap(999),false);delete process.env.KAIROQ_BUILDER_MAX_PROJECTS});
