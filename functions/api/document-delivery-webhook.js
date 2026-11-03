import { recordProviderEvent } from '../internal/_lib/document-delivery.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function onRequestPost({env,request}) {
  if(!env.RESEND_WEBHOOK_SECRET)return json({error:'Delivery webhook is not configured.'},503);
  const id=request.headers.get('svix-id'),timestamp=request.headers.get('svix-timestamp'),signature=request.headers.get('svix-signature');
  if(!id||!timestamp||!signature||!/^\d+$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300)return json({error:'Invalid webhook signature.'},401);
  const body=await request.text();if(body.length>128000)return json({error:'Webhook too large.'},413);
  let key;try{const raw=env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/,'');key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(raw),c=>c.charCodeAt(0)),{name:'HMAC',hash:'SHA-256'},false,['verify']);}catch{return json({error:'Delivery webhook configuration is invalid.'},503);}
  let valid=false;
  for(const entry of signature.split(' ')){const [version,value]=entry.split(',');if(version!=='v1'||!value)continue;try{if(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(value),c=>c.charCodeAt(0)),new TextEncoder().encode(`${id}.${timestamp}.${body}`)))valid=true;}catch{}}
  if(!valid)return json({error:'Invalid webhook signature.'},401);
  let event;try{event=JSON.parse(body);}catch{return json({error:'Invalid webhook body.'},400);}
  const kinds={'email.delivered':'delivered','email.bounced':'bounced','email.complained':'complained','email.failed':'failed','email.delivery_delayed':'delayed'};
  const kind=kinds[event.type];if(!kind)return json({ok:true,ignored:true});
  const providerId=String(event.data?.email_id||'');
  const at=Number.isFinite(Date.parse(event.created_at||''))?new Date(event.created_at).toISOString():new Date(Number(timestamp)*1000).toISOString();
  await recordProviderEvent(env.QUOTES_DB,{webhookId:id,providerId,type:kind,at});
  return json({ok:true});
}
export function onRequest(context){return context.request.method==='POST'?onRequestPost(context):json({error:'Method not allowed.'},405);}
