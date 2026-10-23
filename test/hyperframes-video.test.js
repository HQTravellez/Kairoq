"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const hf=require("../hyperframes-video");
const env={KAIROQ_HYPERFRAMES:"on",HYPERFRAMES_BIN:process.execPath,PATH:process.env.PATH,CHROMIUM_PATH:"/usr/bin/chromium"};
test("composition is deterministic, bounded, seekable and escapes customer-facing text",()=>{
 const x=hf.html({title:"<script>alert('x')</script>",subtitle:"& customer <message>",accent:"#aabbcc"});
 assert.match(x,/data-composition-id="main"/);
 assert.match(x,/data-duration="3"/);
 assert.match(x,/data-width="720"/);
 assert.match(x,/data-height="1280"/);
 assert.match(x,/window.__timelines.main=tl/);
 assert.match(x,/gsap.timeline\(\{paused:true\}\)/);
 assert.match(x,/&lt;script&gt;/);
 assert.match(x,/&amp; customer &lt;message&gt;/);
 assert.doesNotMatch(x,/<script>alert/);
 assert.equal(x,hf.html({title:"<script>alert('x')</script>",subtitle:"& customer <message>",accent:"#aabbcc"}));
});
test("horizontal format preserves validated aspect and rejects unsafe options",()=>{
 const x=hf.options({title:"Product launch",subtitle:"Launch message",aspect:"16:9"});
 assert.equal(x.width,1280);assert.equal(x.height,720);
 for(const invalid of [{title:"",subtitle:"x"},{title:"x",subtitle:"x",aspect:"1:1"},{title:"x",subtitle:"x",accent:"red"},{title:"hi\nbye",subtitle:"ok"}])
  assert.throws(()=>hf.prepare(invalid));
});
test("render is disabled by default; no package download or subprocess runs automatically",async()=>{
 const job=hf.prepare({title:"A launch",subtitle:"A safer fast intro"});
 try{
  let calls=0;
  await assert.rejects(()=>hf.render(job,{env:{},exec:async()=>{calls++}}),/disabled/);
  assert.equal(calls,0);
  assert.equal(hf.configured({KAIROQ_HYPERFRAMES:"on",HYPERFRAMES_BIN:"hyperframes"}),false);
 }finally{hf.cleanup(job)}
});
test("production API can use trusted HTML templates but never accepts arbitrary compositions",()=>{
 assert.equal(typeof hf.html,"function");
 assert.equal(hf.html.toString().includes("raw.html"),false);
 assert.throws(()=>hf.owned({dir:os.tmpdir()}),/Not a Kairoq-created/);
});
test("real CLI arguments are explicit, shell-free, output is verified by MP4 signature and ffprobe",async()=>{
 const job=hf.prepare({title:"New release",subtitle:"A simple, useful preview",aspect:"16:9"});
 const seen=[];
 try{
  const exec=async(bin,args,opts)=>{
   seen.push({bin,args,opts});
   assert.equal(opts.shell,false);assert.equal(opts.cwd,job.dir);
   if(args[0]==="render"){
    const b=Buffer.alloc(1536,0);b.write("ftyp",4,"ascii");fs.writeFileSync(job.output,b);
    return{stdout:"Rendered",stderr:""};
   }
   if(bin==="ffprobe")return{stdout:"3.000\n",stderr:""};
   return{stdout:'{"errors":[]}',stderr:""};
  };
  const out=await hf.render(job,{env,exec});
  assert.equal(out.renderer,"HyperFrames");
  assert.equal(out.duration,3);
  assert.equal(out.bytes,1536);
  assert.equal(seen.length,3);
  assert.deepEqual(seen[0].args,["check","--json"]);
  assert.deepEqual(seen[1].args,["render","--quality","draft","--fps","15","--output","render.mp4"]);
  assert.ok(seen[2].args.includes("format=duration"));
  assert.equal(seen[0].opts.env.DO_NOT_TRACK,"1");
  assert.equal("GITHUB_TOKEN" in seen[0].opts.env,false);
 }finally{hf.cleanup(job)}
});
test("a corrupt MP4 or mismatched duration is rejected after successful CLI calls",async()=>{
 const job=hf.prepare({title:"Launch video",subtitle:"Future proof"});
 try{
  const exec=async(bin,args)=>{
   if(args[0]==="render"){fs.writeFileSync(job.output,Buffer.alloc(1200));return{stdout:"ok"};}
   if(bin==="ffprobe")return{stdout:"3.000"};
   return{stdout:"ok"};
  };
  await assert.rejects(()=>hf.render(job,{env,exec}),/did not produce an MP4/);
  assert.throws(()=>hf.mp4(job.html),/invalid size|did not produce an MP4/);
 }finally{hf.cleanup(job)}
 const another=hf.prepare({title:"Second",subtitle:"A preview"});
 try{
  const exec=async(bin,args)=>{
   if(args[0]==="render"){const b=Buffer.alloc(1500);b.write("ftyp",4);fs.writeFileSync(another.output,b);return{stdout:"ok"}}
   return{stdout:bin==="ffprobe"?"9.1":"ok"};
  };
  await assert.rejects(()=>hf.render(another,{env,exec}),/duration does not match/);
 }finally{hf.cleanup(another)}
});
