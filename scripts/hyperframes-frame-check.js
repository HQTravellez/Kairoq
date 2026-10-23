"use strict";
// Decode two actual video frames and verify the generated motion is not frozen.
// Runs only inside the opted-in HyperFrames isolated CI worker.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const video=path.resolve(process.argv[2]||"benchmark-artifacts/hyperframes-motion.mp4");
if(!fs.existsSync(video))throw Error("Missing rendered MP4");
const json=JSON.parse(execFileSync("ffprobe",["-v","error","-select_streams","v:0","-show_entries","stream=codec_name,width,height,r_frame_rate","-of","json",video],{encoding:"utf8",timeout:12000}));
const stream=json.streams?.[0];
if(!stream||stream.width!==720||stream.height!==1280||stream.codec_name!=="h264")throw Error("Rendered video stream is not the expected 9:16 H.264");
const frames=[];
for(const [label,at] of [["intro","0.6"],["outro","2.4"]]){
 const file=path.join(path.dirname(video),"hyperframes-"+label+".png");
 execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-y","-ss",at,"-i",video,"-frames:v","1",file],{timeout:30000});
 const bytes=fs.readFileSync(file);
 if(bytes.length<2000)throw Error("Decoded frame missing");
 frames.push({at,file,sha256:crypto.createHash("sha256").update(bytes).digest("hex"),bytes:bytes.length});
}
if(frames[0].sha256===frames[1].sha256)throw Error("HyperFrames rendered identical frames: no verified visible change");
console.log(JSON.stringify({status:"two-different-decoded-frames",codec:stream.codec_name,width:stream.width,height:stream.height,fps:stream.r_frame_rate,
 frames:frames.map(x=>({time:x.at,bytes:x.bytes,sha256:x.sha256.slice(0,16)}))},null,2));
