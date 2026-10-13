import {VendorOffer,VendorResearch,safePublicURL,withLegacyPackaging} from "./vendorComparison";

// Fetch only established supplier domains; redirects must stay within this list.
const suppliers=["hospeq.com","greatoakmedical.com","medexsupply.com","medicalecart.com","medline.com","mckesson.com","henryschein.com","boundtree.com","quickmedical.com","mfimedical.com","tigermedical.com","vitalitymedical.com","graylinemedical.com","aaawholesalecompany.com","medicalsupplygroup.com"];
const allowed=(url:string)=>{const safe=safePublicURL(url);if(!safe)return false;const u=new URL(safe);return (!u.port||u.port==="443")&&suppliers.some(d=>u.hostname===d||u.hostname.endsWith("."+d));};
const ref=(value:unknown)=>String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
function plain(html:string){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;|&#34;/gi,'"').replace(/\s+/g," ");}
function products(value:unknown):Record<string,unknown>[]{
 if(Array.isArray(value))return value.flatMap(products);
 if(!value||typeof value!=="object")return [];
 const row=value as Record<string,unknown>;
 const types=Array.isArray(row["@type"])?row["@type"]:[row["@type"]];
 return [...(types.includes("Product")?[row]:[]),...(row["@graph"]?products(row["@graph"]):[])];
}
export function verifyProductHTML(offer:VendorOffer,html:string):VendorOffer["verification"]{
 let exact=false,price=false,packageContext="",pricedPackageContext="";
 for(const tag of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{for(const product of products(JSON.parse(tag[1]))){
   if(!offer.reference||![product.mpn,product.sku,product.model].some(v=>ref(v)===ref(offer.reference)))continue;
   exact=true;
   const context=plain([product.name,product.description,product.size,JSON.stringify(product.additionalProperty||[])].map(v=>String(v||"")).join(" "));
   packageContext+=" "+context;
   const offers=Array.isArray(product.offers)?product.offers:[product.offers];
   for(const raw of offers){if(!raw||typeof raw!=="object")continue;const o=raw as Record<string,unknown>;if(String(o.priceCurrency).toUpperCase()==="USD"&&offer.package_price!==null&&Number(o.price)>0&&Math.abs(Number(o.price)-offer.package_price)<.005){price=true;pricedPackageContext+=" "+context;}}
  }}catch{continue;}
 }
 const evidence=offer.package_evidence?.replace(/\s+/g," ").trim();
 const containsCount=(n:number|null|undefined)=>!!(n&&evidence&&new RegExp("(?:^|\\D)"+n+"(?:\\D|$)").test(evidence));
 const countEvidence=offer.package_type==="EACH"?!!evidence&&/\beach\b/i.test(evidence):offer.package_type==="BOX"?containsCount(offer.each_per_box):offer.package_type==="CASE"?containsCount(offer.each_per_box)&&containsCount(offer.boxes_per_case):false;
 // Only the matching product's own data counts; related-item text is excluded.
 const matchingContext=offer.package_price!==null?pricedPackageContext:packageContext;
 const packageCheck=!!(exact&&offer.package_units&&countEvidence&&evidence&&evidence.length>=3&&matchingContext.toLowerCase().includes(evidence.toLowerCase()));
 return {reference:exact,price,package:packageCheck,checked_at:new Date().toISOString(),reason:exact&&price&&packageCheck?"Supplier product data confirms the reference and USD price; package text was found on the source page.":!exact?"The source page did not provide a machine-readable exact product reference. Review the listing.":!price?"Reference found, but the exact USD price could not be independently confirmed.":"Price and reference found; package quantity still needs review."};
}
async function verifyOffer(offer:VendorOffer):Promise<VendorOffer>{
 const unchecked=(reason:string):VendorOffer=>({...offer,verification:{reference:false,price:false,package:false,reason,checked_at:new Date().toISOString()}});
 if(!allowed(offer.url))return unchecked("Source link available; this supplier is not supported by the automatic page checker.");
 try{
  let url=offer.url;const signal=AbortSignal.timeout(6000);
  for(let redirects=0;redirects<3;redirects++){
   const response=await fetch(url,{redirect:"manual",signal,headers:{"User-Agent":"ASC-Vendor-Comparison/1.0","Accept":"text/html"},cache:"no-store"});
   if(response.status>=300&&response.status<400){const next=new URL(response.headers.get("location")||"",url).href;if(!allowed(next))return unchecked("Supplier redirected outside the supported source domains.");url=next;continue;}
   if(!response.ok||!response.headers.get("content-type")?.includes("text/html"))return unchecked("Supplier page could not be read automatically. Review the source link.");
   const reader=response.body?.getReader();if(!reader)return unchecked("Supplier page had no readable content.");
   const chunks:Uint8Array[]=[];let bytes=0;for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1000000){await reader.cancel();return unchecked("Supplier page was too large to check automatically.");}chunks.push(value);}
   const html=Buffer.concat(chunks).toString("utf8");return {...offer,verification:verifyProductHTML(offer,html)};
  }
  return unchecked("Supplier redirect chain could not be checked.");
 }catch{return unchecked("Automatic source check timed out or was blocked. Review the supplier page.");}
}
export async function verifyResearchSources(research:VendorResearch):Promise<VendorResearch>{
 return {...research,version:2,offers:await Promise.all(research.offers.map(o=>verifyOffer(withLegacyPackaging(o))))};
}
