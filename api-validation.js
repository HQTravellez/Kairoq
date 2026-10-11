'use strict';
// Bounded JSON-schema checks; imported schemas are data, never executable code.
function validate(schema,value,label='value',depth=0){
 if(depth>30)throw Error(label+' exceeds validation depth');
 if(!schema||typeof schema!=='object')return;
 if(schema.$ref)throw Error(label+' uses an unresolved schema reference');
 if(value===null&&schema.nullable)return;
 for(const item of schema.allOf||[])validate(item,value,label,depth+1);
 for(const key of ['anyOf','oneOf'])if(schema[key]){let matches=0;for(const item of schema[key])try{validate(item,value,label,depth+1);matches++;}catch{}if(!matches||(key==='oneOf'&&matches!==1))throw Error(label+' does not match '+key);}
 const type=schema.type;
 const matches=t=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='object'?!!value&&typeof value==='object'&&!Array.isArray(value):t==='integer'?Number.isInteger(value):t==='number'?typeof value==='number'&&Number.isFinite(value):typeof value===t;
 if(type&&!(Array.isArray(type)?type.some(matches):matches(type)))throw Error(label+' must be '+type);
 if(schema.enum&&!schema.enum.some(v=>JSON.stringify(v)===JSON.stringify(value)))throw Error(label+' is outside documented options');
 if(Object.hasOwn(schema,'const')&&JSON.stringify(schema.const)!==JSON.stringify(value))throw Error(label+' must match the documented constant');
 if(typeof value==='string'){if(value.length<(schema.minLength||0)||value.length>(schema.maxLength??50000))throw Error(label+' has invalid length');if(schema.format==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw Error(label+' must be a valid date');if(schema.format==='email'&&!/^\S+@\S+\.\S+$/.test(value))throw Error(label+' must be an email');}
 if(typeof value==='number'&&(value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)))throw Error(label+' is outside documented bounds');
 if(Array.isArray(value)){if(value.length<(schema.minItems||0)||value.length>(schema.maxItems??1000))throw Error(label+' has invalid item count');for(let i=0;i<value.length;i++)validate(schema.items,value[i],label+'['+i+']',depth+1);}
 if(value&&typeof value==='object'&&!Array.isArray(value)){for(const name of schema.required||[])if(!Object.hasOwn(value,name))throw Error(label+' is missing '+name);for(const [key,item]of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe object key');if(schema.properties?.[key])validate(schema.properties[key],item,label+'.'+key,depth+1);else if(schema.additionalProperties===false)throw Error(label+' has unknown field '+key);else if(typeof schema.additionalProperties==='object')validate(schema.additionalProperties,item,label+'.'+key,depth+1);}}
}
function operation(op,args){for(const p of op.requiredParameters||[]){const values=p.in==='path'?args.pathParams:p.in==='query'?args.query:null;if(['path','query'].includes(p.in)&&(!values||values[p.name]===undefined||values[p.name]===null))throw Error('Missing required '+p.in+' parameter: '+p.name);if(p.in==='header')throw Error('Required provider headers need a supported server credential binding: '+p.name);}
 for(const p of op.parameters||[])if(['path','query'].includes(p.in)){const v=(p.in==='path'?args.pathParams:args.query)?.[p.name];if(v!==undefined)validate(p.schema,v,p.in+'.'+p.name);}
 if(op.bodyRequired&&args.body===undefined)throw Error('Request body is required');
 if(op.requestSchema&&args.body!==undefined)validate(op.requestSchema,args.body,'body');
 else for(const f of op.bodyFields||[]){const v=args.body?.[f.name];if(f.required&&(v===undefined||v===null))throw Error('Missing body field: '+f.name);if(v!==undefined)validate({type:f.type},v,'body.'+f.name);}
}
function sanitize(value,secrets=[]){if(Array.isArray(value))return value.map(v=>sanitize(v,secrets));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,/token|secret|password|authorization|api.?key|credential/i.test(key)?'[redacted]':sanitize(v,secrets)]));if(typeof value==='string')for(const secret of secrets)if(typeof secret==='string'&&secret)value=value.split(secret).join('[redacted]');return value;}
module.exports={validate,operation,sanitize};
