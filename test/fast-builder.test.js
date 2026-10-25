"use strict";
// The fast builder model (server.js fastBuilder/callFastBuilder): Ollama Cloud writes Standard
// builds first and streams at once; any failure falls back to the usual OpenRouter models.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
const fastBuilder=new Function(`${/function fastBuilder\(env=process\.env\)\{[\s\S]*?\n\}/.exec(server)[0]}; return fastBuilder;`)();

test('on when chat already uses Ollama Cloud or the fast URL is set; off otherwise or when switched off',()=>{
 assert.equal(fastBuilder({}),null);
 assert.equal(fastBuilder({LOCAL_LLM_BASE_URL:'http://127.0.0.1:11434/v1',LOCAL_LLM_API_KEY:'k'}),null,'a local Ollama is not the fast cloud route');
 assert.deepEqual(fastBuilder({LOCAL_LLM_BASE_URL:'https://ollama.com/v1/',LOCAL_LLM_API_KEY:'k'}),{url:'https://ollama.com/v1',key:'k',model:'qwen3-coder:480b'});
 assert.equal(fastBuilder({KAIROQ_BUILDER_FAST_URL:'https://api.example.com/v1',KAIROQ_BUILDER_FAST_KEY:'x',KAIROQ_BUILDER_FAST_MODEL:'gpt-oss:120b'}).model,'gpt-oss:120b');
 assert.equal(fastBuilder({LOCAL_LLM_BASE_URL:'https://ollama.com/v1',LOCAL_LLM_API_KEY:'k',KAIROQ_BUILDER_FAST:'off'}),null);
 assert.equal(fastBuilder({LOCAL_LLM_BASE_URL:'https://ollama.com/v1'}),null,'needs a key');
});

test('Standard builds try it first, stream, and fall back to the usual models on failure',()=>{
 assert.match(server,/if\(fb&&\(!opts\.tier\|\|opts\.tier==="standard"\)\)\{\s*try\{return await callFastBuilder\(fb,opts,parse\)\}/);
 assert.match(server,/console\.log\("\[builder\] fast model "\+fb\.model\+" failed, using the usual models: "/);
 assert.match(server,/stream:true\}\)\}\);\s*if\(!response\.ok\|\|!response\.body\)/);
});
