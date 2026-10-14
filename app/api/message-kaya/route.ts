import {NextResponse} from "next/server";
import {Resend} from "resend";
import webpush from "web-push";
import {supabaseAdmin} from "@/lib/supabaseAdmin";

const resend=new Resend(process.env.RESEND_API_KEY);
const KAYA_EMAIL=(process.env.KAYA_EMAIL||"kayalivhuebner@gmail.com").toLowerCase();
const KAYA_USER_ID=process.env.KAYA_USER_ID||"3a809b0e-3d2d-4460-b130-6efd9609705d";
const APP_URL=process.env.NEXT_PUBLIC_APP_URL||"https://nextjs-with-supabase-gamma-rosy.vercel.app";
const ALLOWED_ROLES=["admin","staff","preop","kaya"];
const FIELDS="id,created_at,sender_name,subject,message,delivery_status,read_at,read_by,response,responded_at,responded_by";

function tokenFrom(request:Request){const value=request.headers.get("authorization")||"";return value.startsWith("Bearer ")?value.slice(7):"";}
function escapeHtml(value:string){return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
async function authorizedUser(request:Request){
 const token=tokenFrom(request);if(!token)return null;
 const {data,error}=await supabaseAdmin.auth.getUser(token);if(error||!data.user)return null;
 const {data:role}=await supabaseAdmin.from("app_user_roles").select("role").eq("user_id",data.user.id).in("role",ALLOWED_ROLES).limit(1).maybeSingle();
 return role?data.user:null;
}
const isKaya=(email?:string|null)=>(email||"").toLowerCase()===KAYA_EMAIL;

async function sendKayaPush(note:{id:string;subject:string;message:string}){
 const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"BMSdz66vdOV6IRhh5ObmNo8hnU8YlznA3mTxP22SG1JmRrSEhyeurlf5g2qKezphEc76qAjfIkBD9vI2PY9PNJI";
 const privateKey=process.env.VAPID_PRIVATE_KEY;
 const vapidSubject=process.env.VAPID_SUBJECT||"mailto:hogstud800@gmail.com";
 if(!privateKey)return {sent:0,failed:0,configured:false};
 webpush.setVapidDetails(vapidSubject,publicKey,privateKey);
 const {data,error}=await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id",KAYA_USER_ID);
 if(error){console.error("Unable to load Kaya push subscriptions:",error.message);return {sent:0,failed:0,configured:true};}
 const preview=note.message.length>120?note.message.slice(0,117)+"…":note.message;
 const payload=JSON.stringify({title:"✉️ New ASC note for Kaya",body:`${note.subject}: ${preview}`,url:"/message-kaya",tag:`kaya-message-${note.id}`});
 let sent=0,failed=0;
 await Promise.all((data||[]).map(async subscription=>{try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload);sent++;}catch(pushError:unknown){failed++;const statusCode=typeof pushError==="object"&&pushError!==null&&"statusCode" in pushError?Number((pushError as {statusCode?:unknown}).statusCode):0;if(statusCode===404||statusCode===410)await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint",subscription.endpoint);else console.error("Kaya push send failed:",pushError instanceof Error?pushError.message:pushError);}}));
 return {sent,failed,configured:true};
}

export async function GET(request:Request){
 const user=await authorizedUser(request);if(!user)return NextResponse.json({ok:false,error:"Staff access required"},{status:403});
 const kaya=isKaya(user.email);
 if(kaya){
  const readAt=new Date().toISOString();
  const reader=(typeof user.user_metadata?.full_name==="string"&&user.user_metadata.full_name.trim())||"Kaya";
  const {error}=await supabaseAdmin.from("kaya_messages").update({read_at:readAt,read_by:reader}).is("read_at",null);
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
 }
 const {data,error}=await supabaseAdmin.from("kaya_messages").select(FIELDS).order("created_at",{ascending:false}).limit(50);
 if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
 return NextResponse.json({ok:true,messages:data||[],is_kaya:kaya});
}

export async function POST(request:Request){
 try{
  const user=await authorizedUser(request);if(!user)return NextResponse.json({ok:false,error:"Staff access required"},{status:403});
  if(isKaya(user.email))return NextResponse.json({ok:false,error:"Kaya can reply from her inbox"},{status:403});
  const body=await request.json().catch(()=>null);
  const subject=typeof body?.subject==="string"?body.subject.trim():"";
  const message=typeof body?.message==="string"?body.message.trim():"";
  if(!subject||!message)return NextResponse.json({ok:false,error:"Add a subject and message"},{status:400});
  if(subject.length>120||message.length>2000)return NextResponse.json({ok:false,error:"Subject or message is too long"},{status:400});
  const {data:recent}=await supabaseAdmin.from("kaya_messages").select("created_at").eq("sender_user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(recent&&Date.now()-new Date(recent.created_at).getTime()<30000)return NextResponse.json({ok:false,error:"Please wait 30 seconds before sending another note."},{status:429});
  const sender=(typeof user.user_metadata?.full_name==="string"&&user.user_metadata.full_name.trim())||user.email||"ASC Staff";
  const {data:emailData,error:emailError}=await resend.emails.send({
   from:"Baxter ASC <orders@ascinventory.com>",to:[KAYA_EMAIL],subject:`${subject} — Baxter ASC`,
   html:`<div style="background:#f8fafc;padding:28px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden"><div style="background:#9d2235;color:#fff;padding:20px 24px"><div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.7px">Direct note for Kaya</div><div style="font-size:22px;font-weight:800;margin-top:4px">${escapeHtml(subject)}</div></div><div style="padding:24px"><div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:16px;font-size:15px;line-height:1.6">${escapeHtml(message).replaceAll("\n","<br />")}</div><a href="${APP_URL}/message-kaya" style="display:inline-block;margin-top:18px;background:#9d2235;color:#fff;text-decoration:none;border-radius:9px;padding:11px 16px;font-weight:700">Open, read, and reply in the app</a><div style="margin-top:18px;font-size:12px;color:#64748b">Sent by ${escapeHtml(sender)} from the Baxter ASC Inventory app.</div></div></div></div>`,
  });
  if(emailError)return NextResponse.json({ok:false,error:emailError.message},{status:502});
  const {data:saved,error}=await supabaseAdmin.from("kaya_messages").insert({sender_user_id:user.id,sender_name:sender,sender_email:user.email,subject,message,delivery_status:"SENT",provider_message_id:emailData?.id||null}).select(FIELDS).single();
  if(error)throw error;
  const push=await sendKayaPush(saved);
  return NextResponse.json({ok:true,message:saved,push});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Could not send note"},{status:500});}
}

export async function PATCH(request:Request){
 try{
  const user=await authorizedUser(request);if(!user)return NextResponse.json({ok:false,error:"Staff access required"},{status:403});
  if(!isKaya(user.email))return NextResponse.json({ok:false,error:"Only Kaya can reply to these notes"},{status:403});
  const body=await request.json().catch(()=>null);
  const id=typeof body?.id==="string"?body.id.trim():"";
  const response=typeof body?.response==="string"?body.response.trim():"";
  if(!/^[0-9a-f-]{36}$/i.test(id)||!response)return NextResponse.json({ok:false,error:"Type a response first"},{status:400});
  if(response.length>2000)return NextResponse.json({ok:false,error:"Responses are limited to 2,000 characters"},{status:400});
  const responder=(typeof user.user_metadata?.full_name==="string"&&user.user_metadata.full_name.trim())||"Kaya";
  const now=new Date().toISOString();
  const {data,error}=await supabaseAdmin.from("kaya_messages").update({read_at:now,read_by:responder,response,responded_at:now,responded_by:responder}).eq("id",id).select(FIELDS).single();
  if(error)throw error;
  return NextResponse.json({ok:true,message:data});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Could not save reply"},{status:500});}
}
