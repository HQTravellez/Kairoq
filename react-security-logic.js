"use strict";
// Logic-level checks for the security scan (react-security.js): mistakes in who may do what,
// which pattern rules of the code alone rarely catch. Written for Kairoq from the defensive
// side of the vulnerability playbooks in strix by usestrix (Apache License 2.0; IDOR, broken
// function-level authorization, race conditions, business logic, insecure uploads, LLM prompt
// injection). Each rule needs clear evidence in the code, so a finding is worth reading.
function lineOf(code,index){return code.slice(0,index).split('\n').length}
function withoutComments(code){return code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*(\/\/|#).*$/gm,'')}
const FROM_REQUEST=/(request|req)\.(body|query)/;
const OWNERSHIP=/\b(owner|ownerId|owner_id|createdBy|created_by|userId|user_id|user\.id|user\['id'\]|user\["id"\])\b/;
const ROLE=/\b(role|isAdmin|is_admin|admin|staff|team)\b/i;

function scanFile(file,code,add){
 const src=withoutComments(code),client=file.startsWith('src/'),fn=file.startsWith('functions/');
 let m;
 if(client||fn){
  // Visitor text placed inside the AI's instructions.
  if((m=/\bsystem\s*:\s*(`[^`]*\$\{\s*(input|message|msg|question|query|prompt|text|value|body)\b|(input|message|msg|question|query|prompt|text|value)\s*[,}])/i.exec(src))||(fn&&(m=/\bsystem\s*:\s*[^,}\n]*(request|req)\.(body|query)/.exec(src))))
   add('medium','Visitor text is used as instructions for the AI','`'+file+'` puts what the visitor typed into the AI\'s system instructions, so a visitor can tell the AI to ignore its rules (prompt injection).','Keep the system instructions fixed and send the visitor\'s text only as a user message; check the AI\'s answer before acting on it.',file,lineOf(src,m.index));
 }
 if(client){
  if((m=/storage\.upload\(/.exec(src))&&!/(accept=|\.type\b|mime|\.size\b)/.test(src))
   add('low','Uploads accept any kind of file','`'+file+'` uploads files without checking their type or size, and anyone with the link can open an upload.','Limit the input with accept="image/*" (or the types you need), check file.type and file.size before uploading, and never upload private documents.',file,lineOf(src,m.index));
 }
 if(!fn)return;
 const signedIn=/\buser\b/.test(src.replace(/\{\s*user\s*[,}]/,''));
 // A record opened or changed by an id from the request, with no check that it is theirs.
 if((m=/\.(get|update|remove)\s*\(\s*((request|req)\.(body|query)\.\w+|id|recordId|orderId|bookingId)\b/.exec(src))&&FROM_REQUEST.test(src)&&!OWNERSHIP.test(src)&&!ROLE.test(src))
  add('medium','Any signed-in user can open or change any record','`'+file+'` reads, changes or deletes a record by an id taken from the request without checking that it belongs to the signed-in user, so one customer can reach another\'s booking or order by changing the id (IDOR).','After loading the record, check that record.owner equals user.id (or that the user has a staff role) before returning or changing it.',file,lineOf(src,m.index));
 // A staff action that only checks that someone is signed in.
 if(/(^|\/)(admin|staff|manage|export|delete-all|refund|reports?)\b/i.test(file.replace(/^functions\//,''))&&signedIn&&!ROLE.test(src))
  add('medium','Staff-only function open to every signed-in user','`'+file+'` looks like a staff or admin action but only checks that someone is signed in, so any customer with an account can call it.','Also check the user\'s role or team and return 403 for everyone else.',file);
 // Checking what is left, then booking it in a separate step.
 if(/\b(slots?|seats?|stock|capacity|available|remaining|spots?|tickets?)\b/i.test(src)&&/\.(list|get)\s*\(|\bSELECT\b/i.test(src)&&/\.create\s*\(|\bINSERT\b/i.test(src)&&!/\b(batch|BEGIN|transaction|UNIQUE|ON CONFLICT|NOT EXISTS)\b/i.test(src))
  add('low','Two customers can take the last place at the same time','`'+file+'` checks what is available and books it in a separate step, so two requests at the same moment can both succeed: an overbooked slot or oversold stock (a race condition).','Do the check and the booking in one step: db.batch, a SQL transaction, or a UNIQUE constraint (for example on slot and date) so the second request fails.',file);
 // Copying the whole request body onto a record.
 if((m=/Object\.assign\(\s*[^,)]+,\s*(request|req)\.body\s*\)/.exec(src))&&/\.(create|update)\s*\(/.test(src))
  add('medium','Function saves whatever the visitor sends','`'+file+'` copies the whole request body onto a record, so a visitor can set fields you did not mean them to (a price, a role, someone else\'s id).','Copy only the fields you expect, and validate them.',file,lineOf(src,m.index));
 // Amounts and discounts taken from the visitor.
 if((m=/(request|req)\.body\.(price|amount|total|discount|unit_?price)\b/i.exec(src))&&/\b(payments?|checkout|charge|stripe|invoice|order)\b/i.test(src+file))
  add('medium','The price comes from the visitor','`'+file+'` uses a price, amount or discount sent by the visitor\'s browser, which anyone can change before it is sent.','Look up the price on the server (from your products or a fixed price list) and only take the item and quantity from the request.',file,lineOf(src,m.index));
}
module.exports={scanFile};
