export type VendorOffer={vendor:string;product:string;reference:string;match:"EXACT"|"POSSIBLE";package_price:number|null;package_units:number|null;url:string;availability:string;notes:string};
export type VendorResearch={summary:string;offers:VendorOffer[];sources:{url:string;title:string}[]};
export function safePublicURL(value:unknown):string|null{
  if(typeof value!=="string")return null;
  try{const u=new URL(value);if(u.protocol!=="https:"||u.username||u.password||!u.hostname.includes(".")||u.hostname.endsWith(".local")||u.hostname.endsWith(".internal")||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname))return null;return u.href;}catch{return null;}
}
const text=(v:unknown,max=500)=>typeof v==="string"?v.slice(0,max):"";
const positive=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>0&&v<=10000000?v:null;
const normalizeRef=(v:string)=>v.toUpperCase().replace(/[^A-Z0-9]/g,"");
export function sanitizeResearch(raw:unknown,sources:{url:string;title:string}[],reference:string|null):VendorResearch{
  const validSources=sources.filter(s=>safePublicURL(s.url));
  const sourceURLs=new Set(validSources.map(s=>safePublicURL(s.url)));
  const data=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};
  const offers:VendorOffer[]=[];
  for(const candidate of Array.isArray(data.offers)?data.offers.slice(0,8):[]){
    if(!candidate||typeof candidate!=="object")continue;
    const row=candidate as Record<string,unknown>,url=safePublicURL(row.url);
    if(!url||!sourceURLs.has(url))continue;
    const ref=text(row.reference,100);
    const exact=row.match==="EXACT"&&!!reference&&normalizeRef(ref)===normalizeRef(reference);
    offers.push({vendor:text(row.vendor,200),product:text(row.product,300),reference:ref,match:exact?"EXACT":"POSSIBLE",package_price:positive(row.package_price),package_units:positive(row.package_units),url,availability:text(row.availability,200)||"Confirm availability",notes:text(row.notes,1000)});
  }
  return {summary:text(data.summary,2000),offers,sources:validSources.slice(0,20)};
}
