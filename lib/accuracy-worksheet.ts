import type {AccuracyDraft} from "./accuracy-drafts";

export type WorksheetItem={item_id:string;name:string;vendor:string|null;reference_number:string|null;shelf:string|null;unit:string|null;on_hand:number|null;assigned:boolean;is_active:boolean;last_verification:{actual_on_hand:number;verified_at:string;verified_by:string}|null};
export function worksheetEntry(item:WorksheetItem,draft?:AccuracyDraft){
  const verification=item.last_verification;
  const local=draft&&draft.value!==""?draft:undefined;
  if(local&&(local.status!=="saved"||!verification||!local.saved_at||Date.parse(local.saved_at)>=Date.parse(verification.verified_at))){
    const changed=local.unit!==item.unit;
    return {value:local.value,status:changed?`Review: entered in ${local.unit||"unset unit"}`:local.status==="saved"?"Saved count":local.status==="error"?"UNSAVED - review":"UNSAVED on this device",date:local.saved_at||""};
  }
  if(verification)return {value:String(verification.actual_on_hand),status:"Verified count",date:verification.verified_at};
  return {value:"",status:"Not yet counted",date:""};
}

export async function createAccuracyWorksheet(items:WorksheetItem[],drafts:Record<string,AccuracyDraft>,areaName:string,createdAt=new Date(),fontData?:{regular:Uint8Array;bold:Uint8Array}){
  const [{PDFDocument,rgb},{default:fontkit}]=await Promise.all([import("pdf-lib"),import("@pdf-lib/fontkit")]);
  const doc=await PDFDocument.create();
  doc.setTitle(`Baxter ASC inventory count - ${areaName}`);
  doc.registerFontkit(fontkit);
  async function loadFont(path:string){const response=await fetch(path);if(!response.ok)throw new Error("Could not load the PDF fonts. Please try again.");return new Uint8Array(await response.arrayBuffer());}
  const [regularBytes,boldBytes]=fontData?[fontData.regular,fontData.bold]:await Promise.all([loadFont("/fonts/Vera.ttf"),loadFont("/fonts/VeraBd.ttf")]);
  const font=await doc.embedFont(regularBytes,{subset:true}),bold=await doc.embedFont(boldBytes,{subset:true});
  const supported=new Set(font.getCharacterSet());
  const clean=(value:string)=>Array.from(value.replace(/[\r\n\t]+/g," ").replace(/[\u2010-\u2015]/g,"-").replace(/\u00a0/g," ")).map(char=>supported.has(char.codePointAt(0)!)?char:"?").join("");
  const wrap=(value:string,width:number,size:number)=>{
    const lines:string[]=[];let line="";
    for(const word of clean(value).split(/\s+/)){
      if(line&&font.widthOfTextAtSize(`${line} ${word}`,size)>width){lines.push(line);line="";}
      if(font.widthOfTextAtSize(word,size)>width){
        for(const char of word){if(line&&font.widthOfTextAtSize(line+char,size)>width){lines.push(line);line="";}line+=char;}
      }else line+=(line?" ":"")+word;
    }
    if(line)lines.push(line.trimEnd());
    return lines;
  };
  const widths=[210,60,44,32,44,54,108,70,110];
  const headings=["Item / vendor","Reference","Shelf","Unit","Live","Entered","Entry / area status","Paper count","Notes"];
  const stamp=createdAt.toLocaleString("en-US",{timeZone:"America/Chicago",timeZoneName:"short"});
  const date=(value:string)=>value?new Date(value).toLocaleDateString("en-US",{timeZone:"America/Chicago"}):"";
  let page=doc.addPage([792,612]),y=0;
  const text=(value:string,x:number,top:number,size=8,strong=false)=>page.drawText(clean(value),{x,y:top-size,size,font:strong?bold:font,color:rgb(0.08,0.1,0.13)});
  function header(){
    text("BAXTER ASC | INVENTORY COUNT WORKSHEET",30,584,15,true);
    const areaLines=wrap(`Counting area: ${areaName} | Generated: ${stamp}`,732,9);
    areaLines.forEach((line,index)=>text(line,30,560-index*11,9));
    let top=560-areaLines.length*11-3;
    text(`${items.length} catalog items | Counted by: ____________________  Count date: ____________________`,30,top,9);top-=16;
    const instructions=doc.getPageCount()===1?[
      "Entered = your previous count, including saved records and this device's unsaved entries. Live stock may differ.",
      "Write new counts in Paper count. Use the shown unit. Blank means not counted; 0 means none. Enter results in Accuracy later.",
      "Not assigned = no stock record in this area. Inactive items require reactivation before entering a count.",
    ]:["Continue in the displayed unit. Write new counts in Paper count; 0 means none. Keep previous entries for reference."];
    for(const instruction of instructions){for(const line of wrap(instruction,732,8)){text(line,30,top,8);top-=12;}}top-=6;
    page.drawRectangle({x:30,y:top-25,width:732,height:25,color:rgb(0.9,0.93,0.95)});
    let x=30;
    headings.forEach((heading,index)=>{wrap(heading,widths[index]-8,8).forEach((line,n)=>text(line,x+4,top-4-n*9,8,true));x+=widths[index];});
    y=top-25;
  }
  header();
  const rows=[...items].sort((a,b)=>a.name.localeCompare(b.name)||a.item_id.localeCompare(b.item_id));
  for(const item of rows){
    const entry=worksheetEntry(item,drafts[item.item_id]);
    const state=[entry.status,date(entry.date),!item.assigned?"Not assigned here":"",!item.is_active?"INACTIVE":""].filter(Boolean).join(" | ");
    const values=[`${item.name}${item.vendor?` | ${item.vendor}`:""}`,item.reference_number||"",item.shelf||"",item.unit||"Unset",item.assigned?String(item.on_hand??"Unknown"):"N/A",entry.value,state,"",""];
    const lines=values.map((value,index)=>wrap(value,widths[index]-8,8));
    const height=Math.max(28,...lines.map(cell=>cell.length*10+8));
    if(y-height<34){page=doc.addPage([792,612]);header();}
    let x=30;
    lines.forEach((cell,index)=>{
      page.drawRectangle({x,y:y-height,width:widths[index],height,borderWidth:0.4,borderColor:rgb(0.6,0.65,0.7)});
      cell.forEach((line,n)=>text(line,x+4,y-5-n*10,8,index===5));
      x+=widths[index];
    });
    y-=height;
  }
  doc.getPages().forEach((sheet,index)=>{sheet.drawText(`Page ${index+1} of ${doc.getPageCount()} | ${clean(areaName)}`,{x:30,y:18,size:8,font});});
  return doc.save();
}
