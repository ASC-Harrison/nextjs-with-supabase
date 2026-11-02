import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(import.meta.url),ts=require("typescript");
const root=process.env.DRAFT_TEST_SOURCE||path.join(process.cwd(),"lib");
const source=p=>fs.readFileSync(path.join(root,p),"utf8");
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleFrom=(code,context)=>{const box={exports:{}};vm.runInNewContext(compile(code),{...context,module:box,exports:box.exports,structuredClone});return box.exports;};
const core=moduleFrom(source("orderDraftSync.ts"),{});
const A="10000000-0000-0000-0000-000000000001",B="10000000-0000-0000-0000-000000000002",C="10000000-0000-0000-0000-000000000003";
assert.equal(core.readLegacyDraft({items:{[A]:2},notes:{[A]:"keep"}})[0].qty,"2");
assert.throws(()=>core.readLegacyDraft({items:{bad:1}}));
const pending={id:randomUUID(),kind:"patch",changes:[{item_id:A,qty:"8"}]};
assert.equal(core.projectDraft({[A]:{qty:"3",note:"",review:false}},[pending])[A].qty,"8");
assert.equal(core.projectDraft({[A]:{qty:"3",note:"original",review:false}},[{id:randomUUID(),kind:"import",changes:[{item_id:A,qty:"2",note:"other"}]}])[A].qty,"3");

let entries={},revision=0;const applied=new Set();
function server(operations){
 for(const op of operations){
  if(applied.has(op.id))continue;applied.add(op.id);revision++;
  for(const c of op.changes){
   const old=entries[c.item_id];
   if(op.kind==="remove"){if(old&&old.qty===c.before_qty&&old.note===c.before_note)delete entries[c.item_id];else if(old)old.review=true;continue;}
   if(op.kind==="ack"){if(old&&old.qty===c.before_qty&&old.note===c.before_note)old.review=false;continue;}
   if(!old&&c.qty===undefined)continue;
   const next={...(old||{qty:"",note:"",review:false})};
   if(c.qty!==undefined){
    if(!old||old.qty===c.qty||op.kind==="patch"&&old.qty===c.before_qty){next.qty=c.qty;if(old&&old.qty===c.before_qty)next.review=false;}
    else{next.qty=String(Math.max(Number(old.qty||0),Number(c.qty||0)));next.review=true;}
   }
   if(c.note!==undefined){
    if(!old||old.note===c.note||op.kind==="patch"&&old.note===c.before_note||!old.note)next.note=c.note;
    else if(c.note&&!old.note.includes(c.note)){next.note=old.note+"\n--- Other device note ---\n"+c.note;next.review=true;}
   }
   entries[c.item_id]=next;
  }
 }
 return {ok:true,entries:structuredClone(entries),revision};
}
function device(legacy){
 const cells=[],refs=[],effects=[],storage=new Map([["asc-order-draft-v1:user",JSON.stringify(legacy)]]);
 let si=0,ri=0,ei=0,mounted=false,output,fail=false;
 const supabase={auth:{getSession:async()=>({data:{session:{user:{id:"user"},access_token:"test"}}})}};
 const react={
  useState(init){const i=si++;if(!(i in cells))cells[i]=init;return [cells[i],v=>{cells[i]=typeof v==="function"?v(cells[i]):v;}];},
  useRef(init){const i=ri++;if(!refs[i])refs[i]={current:init};return refs[i];},
  useEffect(fn){ei++;if(!mounted)effects.push(fn);}
 };
 const mod=moduleFrom(source("useCloudOrderDraft.ts"),{
  require:p=>p==="react"?react:core,
  crypto:{randomUUID},setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  window:{addEventListener(){},removeEventListener(){}},document:{visibilityState:"visible",addEventListener(){},removeEventListener(){}},
  AbortController,Date,
  fetch:async(_url,opts)=>{await new Promise(r=>setTimeout(r,3));if(fail)throw Error("offline");const json=server(JSON.parse(opts.body).operations);return {ok:true,json:async()=>json};}
 });
 const render=()=>{si=0;ri=0;ei=0;output=mod.useCloudOrderDraft(supabase);return output;};
 render();mounted=true;for(const e of effects)e();
 return {render,storage,setOffline:v=>{fail=v;}};
}
const phone=device({items:{[A]:2},notes:{[A]:"Phone note"}});
await new Promise(r=>setTimeout(r,20));
const ipad=device({items:{[A]:4,[B]:3},notes:{[A]:"iPad note"}});
await new Promise(r=>setTimeout(r,20));
await phone.render().flush();let v=phone.render();
assert.deepEqual(Object.keys(v.items).sort(),[A,B]);
assert.equal(v.items[A],"4");assert.equal(v.review[A],true);
assert.match(v.notes[A],/Phone note/);assert.match(v.notes[A],/iPad note/);
v.confirmItem(A);await v.flush();assert.equal(phone.render().review[A],false);
// Preserve a note typed after quantity transmission starts.
v=phone.render();v.setItems(x=>({...x,[C]:1}));phone.render().setNotes(x=>({...x,[C]:"Typed during sync"}));
await phone.render().flush();assert.equal(entries[C].note,"Typed during sync");
await ipad.render().flush();assert.equal(ipad.render().items[C],"1");
// Offline edits stay queued and reach the other device after reconnection.
phone.setOffline(true);phone.render().setItems(x=>({...x,[B]:9}));
await new Promise(r=>setTimeout(r,340));assert.match(phone.render().error,/unsynced/);
const saved=JSON.parse(phone.storage.get("asc-order-draft-v2:user"));assert.ok(saved.queue.length);
phone.setOffline(false);await phone.render().flush();await ipad.render().flush();assert.equal(ipad.render().items[B],"9");
// A delayed cleanup cannot delete the newer quantity from another device.
const sent=structuredClone(entries);
ipad.render().setItems(x=>({...x,[B]:10}));await ipad.render().flush();
await phone.render().removeSent(sent);
assert.equal(entries[B].qty,"10");assert.equal(entries[B].review,true);
assert.equal(entries[A],undefined);assert.equal(entries[C],undefined);
assert.ok(phone.storage.get("asc-order-draft-v1:user"),"legacy backup must remain");
console.log("PASS: two-device import, quantity review, both notes, in-flight edits, offline retry, cross-device updates, safe send cleanup, legacy preservation");
