// Safe capability registry for presentation engines.
// This module never downloads or executes third-party code.
const PROVIDERS=Object.freeze({
  native:Object.freeze({id:'native',enabled:true,formats:['html','pdf','pptx'],external:false}),
  dashi:Object.freeze({id:'dashi',enabled:false,formats:['html','pdf','pptx'],external:true,requires:['commercial-license-review','isolated-worker','tenant-auth','export-validation']})
});
function selectPresentationProvider(request,options={}){
 const text=String(request||'');
 const isDeck=/\b(pptx?|powerpoint|presentation|pitch deck|slide deck|slides)\b/i.test(text);
 if(!isDeck)return {kind:'not-presentation',provider:null};
 const requested=options.provider==='dashi'?'dashi':'native';
 if(requested==='dashi')return {kind:'presentation',provider:'native',requestedProvider:'dashi',reason:'Dashi disabled pending licensing and isolated worker validation'};
 return {kind:'presentation',provider:'native'};
}
module.exports={PROVIDERS,selectPresentationProvider};
