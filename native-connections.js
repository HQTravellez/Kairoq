"use strict";
// First-class Kairoq connections that are product capabilities, not app integrations.
// Keep scopes intentionally narrow; add new scopes only when a user-facing feature needs them.

const NATIVE=Object.freeze({
  figma:{
    id:"figma",
    displayName:"Figma",
    description:"Read Figma files as design evidence and build from selected frames.",
    auth:{
      type:"OAuth2",
      authUrl:"https://www.figma.com/oauth",
      tokenUrl:"https://api.figma.com/v1/oauth/token",
      refreshUrl:"https://api.figma.com/v1/oauth/refresh",
      scope:["current_user:read","file_content:read","file_metadata:read","library_content:read"],
      pkce:true,
      method:"HEADER",
      refreshWithoutGrant:true
    }
  }
});

function find(id){return NATIVE[String(id||"").toLowerCase()]||null}
function list(){return Object.values(NATIVE).map(x=>({id:x.id,name:x.displayName,description:x.description,scopes:x.auth.scope.slice()}))}
module.exports={find,list,NATIVE};
