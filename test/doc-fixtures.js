const zlib=require('zlib');
// A small valid PDF: one page per entry, each line drawn with Helvetica.
function pdf(pages){
 const objs=[];const add=s=>{objs.push(s);return objs.length};
 const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 const pageIds=[],parent=objs.length+1+pages.length*2+0;
 const kids=[];
 const pagesId=add(null);
 for(const lines of pages){
  const ops=['BT','/F1 12 Tf','72 720 Td','16 TL',...lines.map(l=>l===''?'T*':'('+l.replace(/[()\\]/g,'\\$&')+') Tj T*'),'ET'].join('\n');
  const c=add('<< /Length '+Buffer.byteLength(ops)+' >>\nstream\n'+ops+'\nendstream');
  kids.push(add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 612 792] /Contents '+c+' 0 R /Resources << /Font << /F1 '+font+' 0 R >> >> >>'));
 }
 objs[pagesId-1]='<< /Type /Pages /Kids ['+kids.map(k=>k+' 0 R').join(' ')+'] /Count '+kids.length+' >>';
 const cat=add('<< /Type /Catalog /Pages '+pagesId+' 0 R >>');
 let out='%PDF-1.4\n';const offs=[];
 objs.forEach((o,i)=>{offs.push(Buffer.byteLength(out));out+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});
 const x=Buffer.byteLength(out);
 out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objs.length+1)+' /Root '+cat+' 0 R >>\nstartxref\n'+x+'\n%%EOF\n';
 return Buffer.from(out,'latin1');
}
// A minimal .docx (zip, stored entries) with the given document.xml body.
function crc32(b){let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xedb88320:c>>>1}return(~c)>>>0}
function zip(files){
 const parts=[],central=[];let off=0;
 for(const [name,content] of Object.entries(files)){
  const data=Buffer.from(content),n=Buffer.from(name),crc=crc32(data);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);
  parts.push(h,n,data);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(off,42);
  central.push(c,n);off+=30+n.length+data.length;
 }
 const cd=Buffer.concat(central),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(Object.keys(files).length,8);e.writeUInt16LE(Object.keys(files).length,10);e.writeUInt32LE(cd.length,12);e.writeUInt32LE(off,16);
 return Buffer.concat([...parts,cd,e]);
}
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
function docx(body){return zip({'[Content_Types].xml':'<?xml version="1.0"?><Types/>','word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document '+W+'><w:body>'+body+'</w:body></w:document>'})}
const para=(t,style)=>'<w:p>'+(style?'<w:pPr><w:pStyle w:val="'+style+'"/></w:pPr>':'')+'<w:r><w:t xml:space="preserve">'+t+'</w:t></w:r></w:p>';
module.exports={pdf,docx,para};
