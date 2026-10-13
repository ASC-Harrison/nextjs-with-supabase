export type VendorOffer={vendor:string;product:string;reference:string;match:"EXACT"|"POSSIBLE";package_price:number|null;package_units:number|null;url:string;availability:string;notes:string;package_type?:"EACH"|"BOX"|"CASE"|"UNKNOWN";each_per_box?:number|null;boxes_per_case?:number|null;package_evidence?:string;currency?:string;verification?:{reference:boolean;price:boolean;package:boolean;reason:string;checked_at:string}};
export type VendorResearch={summary:string;offers:VendorOffer[];sources:{url:string;title:string}[];version?:number};
export function packageEaches(type:string,eachPerBox:number|null,boxesPerCase:number|null):number|null{
  if(type==="EACH")return 1;
  if(!eachPerBox||!Number.isInteger(eachPerBox)||eachPerBox<1)return null;
  if(type==="BOX")return eachPerBox;
  if(type==="CASE"&&boxesPerCase&&Number.isInteger(boxesPerCase)&&boxesPerCase>0)return eachPerBox*boxesPerCase;
  return null;
}
export function withLegacyPackaging(offer:VendorOffer):VendorOffer{
  if(offer.package_type&&offer.package_type!=="UNKNOWN")return offer;
  const description=offer.product+" "+offer.notes;
  const box=description.match(/\b(\d+)\s*(?:\/|per\s+)\s*(?:box|bx)\b/i)||description.match(/\bbox\s+(?:of|quantity\s+of)\s+(\d+)\b/i);
  if(box&&Number(box[1])===offer.package_units)return {...offer,package_type:"BOX",each_per_box:offer.package_units,package_evidence:offer.package_evidence||box[0]};
  return offer;
}
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
    const packageType=["EACH","BOX","CASE"].includes(String(row.package_type))?row.package_type as "EACH"|"BOX"|"CASE":"UNKNOWN";
    const perBox=positive(row.each_per_box),perCase=positive(row.boxes_per_case),derived=packageEaches(packageType,perBox,perCase);
    const stated=positive(row.package_units);
    const consistent=derived!==null&&(stated===null||stated===derived);
    const currency=text(row.currency,10).toUpperCase();
    offers.push({vendor:text(row.vendor,200),product:text(row.product,300),reference:ref,match:exact?"EXACT":"POSSIBLE",package_price:currency==="USD"?positive(row.package_price):null,package_units:consistent?derived:null,package_type:packageType,each_per_box:perBox,boxes_per_case:perCase,package_evidence:text(row.package_evidence,300),currency,url,availability:text(row.availability,200)||"Confirm availability",notes:text(row.notes,1000)+(consistent?"":" Package quantity needs confirmation; excluded from automatic savings.")});
  }
  return {summary:text(data.summary,2000),offers,sources:validSources.slice(0,20),version:2};
}
