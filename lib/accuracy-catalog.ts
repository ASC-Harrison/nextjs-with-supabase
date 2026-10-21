export type AccuracyCatalogItem={id:string;name:string;reference_number:string|null;vendor:string|null;unit:string|null;category:string|null;barcode:string|null;item_number:string|null;is_active:boolean|null};
export type AccuracyLocation={item_id:string;storage_area_id:string;on_hand:number|null;shelf:string|null;updated_at:string|null};
export type AccuracyVerification={item_id:string;actual_on_hand:number;difference:number;verified_by:string;verified_at:string};
export async function readAllAccuracyPages<T>(page:(from:number,to:number)=>PromiseLike<{data:unknown;error:{message:string}|null}>){
  const rows:T[]=[];
  for(let from=0;;from+=500){const result=await page(from,from+499);if(result.error)throw new Error(result.error.message);const batch=(result.data||[]) as T[];rows.push(...batch);if(batch.length<500)return rows;}
}
export function accuracyCatalog(items:AccuracyCatalogItem[],stock:AccuracyLocation[],verifications:AccuracyVerification[],areas:{id:string;name:string;active:boolean}[],areaId:string){
  const areaMap=new Map(areas.map(area=>[area.id,area]));
  const current=new Map(stock.filter(row=>row.storage_area_id===areaId).map(row=>[row.item_id,row]));
  const latest=new Map<string,AccuracyVerification>();
  for(const row of verifications){const old=latest.get(row.item_id);if(!old||Date.parse(row.verified_at)>Date.parse(old.verified_at))latest.set(row.item_id,row);}
  return items.map(item=>{
    const row=current.get(item.id);
    return {...item,item_id:item.id,is_active:item.is_active===true,assigned:Boolean(row),shelf:row?.shelf??null,on_hand:row?.on_hand??null,updated_at:row?.updated_at??null,last_verification:row?latest.get(item.id)||null:null,
      locations:stock.filter(location=>location.item_id===item.id).map(location=>({area_id:location.storage_area_id,area_name:areaMap.get(location.storage_area_id)?.name||"Unknown area",active:areaMap.get(location.storage_area_id)?.active===true,on_hand:location.on_hand})),
    };
  }).sort((a,b)=>a.name.localeCompare(b.name)||a.item_id.localeCompare(b.item_id));
}
export function matchesAccuracySearch(item:{name:string;reference_number:string|null;vendor:string|null;category:string|null;shelf:string|null;barcode?:string|null;item_number?:string|null},query:string){
  const normalize=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const fields=[item.name,item.reference_number,item.vendor,item.category,item.shelf,item.barcode,item.item_number].map(value=>normalize(value||""));
  const tokens=query.trim().split(/\s+/).map(normalize).filter(Boolean);
  return tokens.every(token=>fields.some(field=>field.includes(token)));
}
