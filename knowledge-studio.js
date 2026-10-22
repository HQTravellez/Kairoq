// Knowledge Studio core: safe text ingestion and cited retrieval.
// PDF/DOCX/EPUB require a separate, sandboxed extraction adapter.
import { createHash, randomUUID } from 'node:crypto';
const MAX_BYTES = 2 * 1024 * 1024;
const supported = new Set(['text/plain','text/markdown','application/json','text/html']);
function tokenize(s) { return [...new Set((s.toLowerCase().match(/[a-z0-9_-]{3,}/g) || []))]; }
function split(text, size=1500) {
  const chunks=[]; for(let i=0;i<text.length;i+=size) chunks.push({offset:i,text:text.slice(i,i+size)}); return chunks;
}
export function createKnowledgeStudio() {
  const documents = new Map();
  return {
    ingest({name,mimeType,content,ownerId,sourceVersion='1'}) {
      if (!ownerId || typeof ownerId!=='string') throw new Error('ownerId required');
      if (!supported.has(mimeType)) throw new Error('Unsupported format: extraction required');
      if(typeof content!=='string'|| !content.trim() || Buffer.byteLength(content)>MAX_BYTES) throw new Error('Invalid content size');
      if(!name || typeof name!=='string') throw new Error('Document name required');
      const id=randomUUID(), hash=createHash('sha256').update(content).digest('hex');
      const record={id,name,mimeType,ownerId,sourceVersion,hash,createdAt:new Date().toISOString(),chunks:split(content)};
      documents.set(id,record);
      return {id,name,sourceVersion,hash,chunkCount:record.chunks.length};
    },
    search({query,ownerId,limit=5}) {
      if (!ownerId || !query || typeof query!=='string') return [];
      const terms=tokenize(query);
      return [...documents.values()].filter(d=>d.ownerId===ownerId)
        .flatMap(d=>d.chunks.map((c,index)=>{
          const words=tokenize(c.text), score=terms.filter(t=>words.includes(t)).length;
          return {documentId:d.id,name:d.name,sourceVersion:d.sourceVersion,hash:d.hash,chunk:index,offset:c.offset,excerpt:c.text,score};
        })).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(0,Math.min(20,limit)));
    },
    list(ownerId) { return [...documents.values()].filter(d=>d.ownerId===ownerId).map(({chunks,ownerId,...d})=>({...d,chunkCount:chunks.length})); },
    remove(id,ownerId) { const d=documents.get(id); if(!d || d.ownerId!==ownerId) return false; return documents.delete(id); }
  };
}
