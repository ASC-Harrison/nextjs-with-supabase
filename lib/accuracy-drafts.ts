export type AccuracyDraft={value:string;expected:number;unit:string|null;status:"pending"|"saved"|"error";saved_at?:string;error?:string;conflict?:boolean};
export function accuracyDraftKey(userId:string,areaId:string){return `asc-accuracy-v1:${userId}:${areaId}`;}
export function readAccuracyDrafts(raw:string|null):Record<string,AccuracyDraft>{
  try{
    const value=JSON.parse(raw||"{}");if(!value||Array.isArray(value)||typeof value!=="object")return {};
    const clean:Record<string,AccuracyDraft>={};
    for(const [id,entry] of Object.entries(value)){
      const row=entry as AccuracyDraft;
      if(!row||typeof row!=="object"||typeof row.value!=="string"||!/^\d{0,7}$/.test(row.value)||!Number.isInteger(row.expected)||row.expected<0||(row.unit!==null&&typeof row.unit!=="string"))continue;
      clean[id]={value:row.value,expected:row.expected,unit:row.unit,status:row.status==="saved"?"saved":row.status==="error"?"error":"pending",saved_at:typeof row.saved_at==="string"?row.saved_at:undefined,error:typeof row.error==="string"?row.error:undefined,conflict:row.conflict===true};
    }
    return clean;
  }catch{return {};}
}
