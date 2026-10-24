"use strict";
// Seed registry of public developer entry points; metadata only, NOT trained or verified APIs.
// Do not scrape gated pages, cache copyrighted prose, or make authenticated API calls.
const entries=[
 ["sabre","Sabre","gds","https://developer.sabre.com/"],
 ["travelport","Travelport","gds","https://developer.travelport.com/"],
 ["amadeus","Amadeus","flights","https://developers.amadeus.com/"],
 ["duffel","Duffel","flights","https://duffel.com/docs"],
 ["expedia","Expedia Group Rapid","lodging","https://developers.expediagroup.com/docs/"],
 ["booking-connectivity","Booking.com Connectivity","lodging","https://developers.booking.com/connectivity/docs"],
 ["booking-demand","Booking.com Demand","lodging","https://developers.booking.com/demand/docs"],
 ["hotelbeds","Hotelbeds","lodging","https://developer.hotelbeds.com/"],
 ["liteapi","LiteAPI","lodging","https://docs.liteapi.travel/"],
 ["tripadvisor","Tripadvisor Content API","activities","https://developer-tripadvisor.com/"],
 ["viator","Viator Partner API","activities","https://docs.viator.com/partner-api/"],
 ["skyscanner","Skyscanner Travel API","metasearch","https://developers.skyscanner.net/"],
 ["kiwi","Kiwi.com Tequila","flights","https://tequila.kiwi.com/portal/docs/tequila_api"],
 ["airalo","Airalo Partners","connectivity","https://developers.partners.airalo.com/"],
 ["flightradar24","Flightradar24","flight-data","https://fr24api.flightradar24.com/"],
 ["cirium","Cirium","flight-data","https://developer.cirium.com/"],
 ["openstreetmap","OpenStreetMap Overpass","maps","https://wiki.openstreetmap.org/wiki/Overpass_API"],
 ["google-maps","Google Maps Platform","maps","https://developers.google.com/maps/documentation"],
 ["stripe","Stripe","payments","https://docs.stripe.com/api"],
 ["guesty","Guesty","property-management","https://open-api-docs.guesty.com/"],
 ["channex","Channex","property-management","https://docs.channex.io/"],
 ["cloudbeds","Cloudbeds","property-management","https://developers.cloudbeds.com/"],
 ["mews","Mews","property-management","https://docs.mews.com/"],
 ["rail-europe","Rail Europe","rail","https://developers.raileurope.com/"],
 ["trainline","Trainline Partner Solutions","rail","https://www.thetrainline.com/solutions"]
];
const registry=entries.map(([id,name,category,docsUrl])=>({
 id,name,industry:"travel",category,docsUrl,sourceType:"official-developer-entry",
 status:"seeded-unverified",access:"unknown",auth:"unknown",lastFetchedAt:null,operations:[],evidence:[]
}));
function validateSeed(r){
 if(!Array.isArray(r))throw Error("Registry must be an array");
 const seen=new Set();
 for(const p of r){
  if(!/^[a-z0-9-]+$/.test(p.id)||seen.has(p.id))throw Error("Invalid or duplicate provider ID");
  seen.add(p.id);
  const u=new URL(p.docsUrl);
  if(u.protocol!=="https:"||u.username||u.password)throw Error("Provider docs require HTTPS");
  if(p.status!=="seeded-unverified")throw Error("Seeds cannot claim verified API status");
 }
 return true;
}
validateSeed(registry);
module.exports={registry,validateSeed};
