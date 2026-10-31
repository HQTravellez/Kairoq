"use strict";
// Agent-mode visual quality gate. Reuses Kairoq's real-page craft measurements
// without mutating the project. The Lead Agent must repair failures itself.

const UI_FILE=/(^|\/)(src\/.*\.(jsx|tsx|css)|index\.html|styles?\.css)$/i;

function changedFiles(base={},current={}){
  return [...new Set([...Object.keys(base),...Object.keys(current)])]
    .filter(k=>base[k]!==current[k]).sort();
}

function required({base={},current={},request=""}={}){
  const changed=changedFiles(base,current);
  if(changed.some(f=>UI_FILE.test(f)))return true;
  return /\b(ui|ux|design|layout|page|website|app|dashboard|form|screen|responsive|mobile|landing|visual|style|redesign)\b/i.test(String(request||""));
}

function factsFromMeta(meta={}){
  return [...(meta.messages||[]).filter(m=>m.role==="user").map(m=>m.text),meta.knowledge||""]
    .filter(Boolean).join("\n").slice(-16000);
}

async function evaluate({url,request,meta={},designShots,reviewLook,signal}={}){
  const result={
    required:true,
    passed:false,
    screenshots:0,
    measuredIssues:[],
    director:null,
    evidence:[]
  };
  if(typeof designShots!=="function"){
    result.reason="Visual screenshot measurement is unavailable.";
    return result;
  }
  let pictures;
  try{pictures=await designShots(url)}
  catch(e){
    result.reason="Visual screenshot capture failed: "+String(e.message||e).slice(0,300);
    return result;
  }
  if(!Array.isArray(pictures)||!pictures.length){
    result.reason="No visual screenshots were produced.";
    return result;
  }
  result.screenshots=pictures.length;
  result.evidence=pictures.map(p=>({
    screen:String(p.name||p.label||"screen").slice(0,80),
    width:Number(p.width)||null,
    height:Number(p.height)||null
  }));
  const craft=require("./craft-check");
  const type=meta.design?.norms||require("./craft-norms").typeOf((meta.name||"")+" "+String(request||""));
  const measured=craft.found(pictures,factsFromMeta(meta),type);
  result.measuredIssues=measured.map(i=>({
    severity:i.severity,
    kind:i.kind,
    issue:i.issue,
    fix:i.fix
  }));
  const majors=measured.filter(i=>i.severity==="major");
  if(majors.length){
    result.reason="Measured visual quality found "+majors.length+" major issue(s).";
    return result;
  }
  if(typeof reviewLook==="function"&&!(signal&&signal.aborted)){
    try{
      const seen=await reviewLook({
        request,
        pictures,
        signal,
        prompt:craft.reviewPrompt(request,(require("./design-presets").byType(meta.design?.playbook||"")||{}).avoid,type)
      });
      if(seen){
        result.director={ok:seen.ok===true,problems:Array.isArray(seen.problems)?seen.problems.slice(0,6):[]};
        if(seen.ok!==true){
          result.reason="Design review found material visual problems.";
          return result;
        }
      }
    }catch(e){
      result.director={ok:false,problems:["Design review could not complete: "+String(e.message||e).slice(0,240)]};
      result.reason="Design review could not complete.";
      return result;
    }
  }
  result.passed=true;
  result.reason="";
  return result;
}

function failureText(result){
  if(!result)return"Visual quality was not evaluated.";
  const issues=(result.measuredIssues||[]).filter(i=>i.severity==="major").map((i,n)=>(n+1)+". "+i.issue+" Fix: "+i.fix);
  const director=result.director&&!result.director.ok?(result.director.problems||[]).map((p,n)=>(issues.length+n+1)+". "+p):[];
  const detail=[...issues,...director];
  return [result.reason||"Visual quality did not pass.",...detail].join("\n");
}

module.exports={changedFiles,required,evaluate,failureText,factsFromMeta};
