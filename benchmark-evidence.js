'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function read(report,surface,index,{appRoot=require('./app-runtime').ROOT,websiteRoot=path.join(__dirname,'workspace','generated','developer-sites')}={}){
 if(!['app','website'].includes(surface)||!Number.isSafeInteger(index)||index<1)throw Error('Invalid evidence request');
 const project=report?.[surface],entry=project?.deployed_qa?.evidence?.[index-1];
 if(!entry||!/^[a-z0-9-]{5,85}$/.test(project.id))throw Error('Evidence unavailable');
 let folder;
 if(surface==='app'){const version=project.deployed_qa.version;if(!Number.isSafeInteger(version)||version<1)throw Error('Invalid evidence version');folder=path.join(appRoot,project.id,'release-evidence',String(version));}
 else{if(!/^[a-f0-9]{16}$/.test(project.published_version||''))throw Error('Invalid evidence version');folder=path.join(websiteRoot,project.id,project.published_version);}
 const bytes=fs.readFileSync(path.join(folder,'design-evidence',index+'.jpg'));
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Evidence hash mismatch');return bytes;
}
module.exports={read};
