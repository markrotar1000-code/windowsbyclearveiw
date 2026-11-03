// One durable attempt per user action; provider retries use the same idempotency key.
export async function ensureDeliverySchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS document_deliveries (id TEXT PRIMARY KEY, document_kind TEXT NOT NULL, document_id TEXT NOT NULL, document_version TEXT NOT NULL, recipient TEXT NOT NULL, created_at TEXT NOT NULL, actor TEXT NOT NULL DEFAULT 'mark', provider_id TEXT)`).run();
  try{await db.prepare('ALTER TABLE document_deliveries ADD COLUMN sealed_payload TEXT').run();}catch(error){if(!/duplicate column/i.test(String(error?.message||error)))throw error;}
  await db.prepare(`CREATE TABLE IF NOT EXISTS document_delivery_events (id INTEGER PRIMARY KEY AUTOINCREMENT, delivery_id TEXT NOT NULL, event_type TEXT NOT NULL, at TEXT NOT NULL, detail TEXT, webhook_id TEXT UNIQUE)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS document_provider_events (webhook_id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, event_type TEXT NOT NULL, at TEXT NOT NULL)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_document_provider_event_email ON document_provider_events(provider_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_document_delivery_record ON document_deliveries(document_kind,document_id,created_at)`).run();
}
export async function deliveryHistory(db, kind, id) {
  await ensureDeliverySchema(db);
  const { results } = await db.prepare(`SELECT d.*, (SELECT event_type FROM document_delivery_events e WHERE e.delivery_id=d.id ORDER BY CASE WHEN e.event_type='complained' THEN 60 WHEN e.event_type='bounced' THEN 50 WHEN e.event_type='failed' AND e.webhook_id IS NOT NULL THEN 40 WHEN e.event_type='delivered' THEN 30 WHEN e.event_type='delayed' THEN 20 WHEN e.event_type='accepted' THEN 10 ELSE 0 END DESC, e.at DESC, e.id DESC LIMIT 1) AS status FROM document_deliveries d WHERE document_kind=? AND document_id=? ORDER BY created_at DESC LIMIT 50`).bind(kind,id).all();
  return (results || []).map(({sealed_payload,...row})=>row);
}
export async function appendDeliveryEvent(db, id, type, detail = '', webhookId = null) {
  await db.prepare(`INSERT OR IGNORE INTO document_delivery_events(delivery_id,event_type,at,detail,webhook_id) VALUES(?,?,?,?,?)`).bind(id,type,new Date().toISOString(),String(detail).slice(0,500),webhookId).run();
}
// Persist verified callbacks before looking for the sender's provider-id write. Either
// side can finish first; both reconcile from this durable inbox without losing events.
export async function reconcileProviderEvents(db, providerId) {
  if(!providerId)return;
  await db.prepare(`INSERT OR IGNORE INTO document_delivery_events(delivery_id,event_type,at,detail,webhook_id)
    SELECT d.id,p.event_type,p.at,'Verified provider event',p.webhook_id FROM document_provider_events p
    JOIN document_deliveries d ON d.provider_id=p.provider_id WHERE p.provider_id=?`).bind(providerId).run();
}
export async function recordProviderEvent(db,{webhookId,providerId,type,at}) {
  await ensureDeliverySchema(db);
  if(!providerId)return;
  await db.prepare('INSERT OR IGNORE INTO document_provider_events(webhook_id,provider_id,event_type,at) VALUES(?,?,?,?)').bind(webhookId,providerId,type,at).run();
  await reconcileProviderEvents(db,providerId);
}
async function payloadKey(env){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.INTERNAL_SESSION_SECRET||env.RESEND_API_KEY));return crypto.subtle.importKey('raw',hash,'AES-GCM',false,['encrypt','decrypt']);}
async function sealPayload(env,payload){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await payloadKey(env),new TextEncoder().encode(JSON.stringify(payload))));let s='';for(const n of [...iv,...bytes])s+=String.fromCharCode(n);return btoa(s);}
async function unsealPayload(env,sealed){const bytes=Uint8Array.from(atob(sealed),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},await payloadKey(env),bytes.slice(12)));}
export async function sendDocumentEmail(env, { requestId, documentKind, documentId, documentVersion, to, payload }) {
  if (!env.RESEND_API_KEY) return { error:'Email delivery is not configured yet (RESEND_API_KEY).', status:503 };
  const db=env.QUOTES_DB;
  await ensureDeliverySchema(db);
  const id=requestId || crypto.randomUUID();
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) return {error:'Invalid delivery request id.',status:400};
  const version=String(documentVersion || '1');
  await db.prepare(`INSERT OR IGNORE INTO document_deliveries(id,document_kind,document_id,document_version,recipient,created_at) VALUES(?,?,?,?,?,?)`).bind(id,documentKind,documentId,version,to,new Date().toISOString()).run();
  const row=await db.prepare('SELECT * FROM document_deliveries WHERE id=?').bind(id).first();
  if(row.document_kind!==documentKind || row.document_id!==documentId || row.document_version!==version || row.recipient!==to) return {error:'This delivery request belongs to another document or recipient. Start a new send.',status:409};
  if(row.provider_id) {await reconcileProviderEvents(db,row.provider_id);return {ok:true,to,providerId:row.provider_id,deliveryId:id,replayed:true};}
  const sealed=await sealPayload(env,payload);
  await db.prepare('UPDATE document_deliveries SET sealed_payload=COALESCE(sealed_payload,?) WHERE id=?').bind(sealed,id).run();
  const stored=await db.prepare('SELECT sealed_payload FROM document_deliveries WHERE id=?').bind(id).first();
  let body;try{body=await unsealPayload(env,stored.sealed_payload);}catch{return {error:'This delivery attempt cannot be recovered after a configuration change. Start a new send.',status:409};}
  await appendDeliveryEvent(db,id,'queued');
  try {
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','Idempotency-Key':`clearview-${id}`},body});
    const result=await response.json().catch(()=>({}));
    if(!response.ok){await appendDeliveryEvent(db,id,'failed',`Provider rejected request (${response.status}).`);return {error:'Email provider did not accept the message. Retry this send.',status:502,deliveryId:id};}
    await db.prepare('UPDATE document_deliveries SET provider_id=? WHERE id=?').bind(result.id||null,id).run();
    await reconcileProviderEvents(db,result.id);
    await appendDeliveryEvent(db,id,'accepted');
    return {ok:true,to,providerId:result.id||null,deliveryId:id};
  } catch {await appendDeliveryEvent(db,id,'unknown','Provider response unavailable; retry uses the same idempotency key.');return {error:'Delivery confirmation was interrupted. Retry this send safely.',status:502,deliveryId:id};}
}
