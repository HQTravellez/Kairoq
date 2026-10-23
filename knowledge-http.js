// Framework-neutral Knowledge Studio HTTP handler. The host MUST provide
// authenticated tenant identity; never accept ownerId from request bodies.
const {createStore}=require('./knowledge-persistent');
function createKnowledgeHandler({file,authenticate}){
 if(typeof authenticate!=='function')throw Error('Authenticated identity resolver required');
 const store=createStore(file);
 return async function handle(req,res){
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/api/knowledge/'))return false;
  const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  try{
   const ownerId=await authenticate(req);
   if(typeof ownerId!=='string'||!ownerId.trim()){reply(401,{error:'Authentication required'});return true;}
   if(req.method==='GET'&&url.pathname==='/api/knowledge/documents'){reply(200,{documents:store.list(ownerId)});return true;}
   if(req.method==='GET'&&url.pathname==='/api/knowledge/search'){reply(200,{results:store.search({ownerId,query:url.searchParams.get('q')||''})});return true;}
   if(req.method==='POST'&&url.pathname==='/api/knowledge/documents'){
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2.5*1024*1024){reply(413,{error:'Payload too large'});return true;}}
    const data=JSON.parse(body);const result=store.ingest({...data,ownerId});reply(201,result);return true;
   }
   if(req.method==='DELETE'&&url.pathname.startsWith('/api/knowledge/documents/')){
    const id=url.pathname.slice('/api/knowledge/documents/'.length);
    reply(store.remove(ownerId,id)?200:404,{deleted:true});return true;
   }
   reply(405,{error:'Unsupported operation'});return true;
  }catch(err){reply(err instanceof SyntaxError?400:422,{error:err.message});return true;}
 };
}
module.exports={createKnowledgeHandler};
