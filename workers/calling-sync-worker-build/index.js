var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../functions/internal/_lib/google-auth.mjs
var TOKEN_URL = "https://oauth2.googleapis.com/token";
async function googleJson(url, init = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15e3) });
  if (!response.ok) throw new Error("Google service unavailable");
  return response.json();
}
__name(googleJson, "googleJson");
function accountConfig(raw) {
  try {
    const a = JSON.parse(raw || "null");
    return a?.client_email && a?.private_key?.includes("BEGIN PRIVATE KEY") ? a : null;
  } catch {
    return null;
  }
}
__name(accountConfig, "accountConfig");
var b64 = /* @__PURE__ */ __name((bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "b64");
var encode = /* @__PURE__ */ __name((value) => b64(new TextEncoder().encode(JSON.stringify(value))), "encode");
async function googleToken(account, scope, fetchImpl = fetch) {
  const now = Math.floor(Date.now() / 1e3);
  const payload = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: account.client_email, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = b64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(payload)));
  const data = await googleJson(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${payload}.${signature}` }) }, fetchImpl);
  if (!data.access_token) throw new Error("Google service unavailable");
  return data.access_token;
}
__name(googleToken, "googleToken");

// ../../functions/internal/_lib/skip-trace.mjs
var SKIP_DDL = [
  `CREATE TABLE IF NOT EXISTS skip_trace_prospects (id TEXT PRIMARY KEY, batch TEXT NOT NULL, data_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', notes TEXT NOT NULL DEFAULT '', follow_up TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS skip_trace_history (id INTEGER PRIMARY KEY AUTOINCREMENT, prospect_id TEXT NOT NULL, status TEXT NOT NULL, notes TEXT NOT NULL, follow_up TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS skip_trace_enrichment (prospect_id TEXT PRIMARY KEY, data_json TEXT NOT NULL, researched_at TEXT NOT NULL)`
];
function propertyEligibility(research, year = (/* @__PURE__ */ new Date()).getFullYear()) {
  const built = research?.yearBuilt;
  if (Number.isInteger(built) && built >= 1700 && built <= 1978) return { status: "excluded", reason: "Built in 1978 or earlier: outside ClearView service scope." };
  if (research?.excludeReason) return { status: "hold", reason: research.excludeReason };
  if (!Number.isInteger(built) || built < 1979 || built > year || !["high", "medium"].includes(research?.confidence)) return { status: "hold", reason: "Verify a build year of 1979 or later before outreach." };
  return { status: "eligible", reason: `Built ${built}: meets the 1979-or-later property cutoff. Phone and owner checks still required.` };
}
__name(propertyEligibility, "propertyEligibility");
async function ensureSkipTables(db) {
  for (const sql of SKIP_DDL) await db.prepare(sql).run();
}
__name(ensureSkipTables, "ensureSkipTables");

// ../../functions/internal/_lib/mail-pilot.mjs
var DEFAULT_RULES = Object.freeze({
  minPrice: 5e4,
  cutoffYear: 1995,
  likelyDeeds: Object.freeze(["D-SWD", "D-WARR", "D-B&S"])
});
var SEGMENTS = Object.freeze([
  { key: "A", name: "Re-roof permit", wave: "wave1", rule: "A re-roof permit was issued at this home in the window." },
  { key: "B", name: "Remodel / addition permit", wave: "wave1", rule: "A remodel or addition permit was issued in the window. The county does not publish what the work is." },
  { key: "C", name: "Recent buyer, older home", wave: "wave1", rule: "Sold in the window to a likely market buyer, no permit, and built in or before the cutoff year." },
  { key: "D", name: "Recent buyer, newer home", wave: "compare", rule: "Same as C but built after the cutoff year (or the year is unknown). Not in wave 1: mail a small batch later to see whether home age changes the response." },
  { key: "E", name: "Other transfer (hold)", wave: "hold", rule: "No permit and not a likely market sale: a quitclaim, probate, trust transfer or a sale with no price." }
]);
var WAVE1_SEGMENTS = Object.freeze(SEGMENTS.filter((s) => s.wave === "wave1").map((s) => s.key));
var AGE_BANDS = Object.freeze(["1979 or earlier", "1980 to 1995", "1996 to 2005", "2006 to 2015", "2016 or later", "Unknown"]);
var PRICE_BANDS = Object.freeze(["Under $300k", "$300k to $399k", "$400k to $499k", "$500k to $599k", "$600k to $799k", "$800k and up"]);

// ../../functions/internal/_lib/supplier-permits.mjs
var CONTACT_DDL = [
  `CREATE TABLE IF NOT EXISTS supplier_contact_blocks (
    phone TEXT PRIMARY KEY, reason TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS supplier_contact_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, permit_id TEXT, who TEXT NOT NULL, outcome TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_contact_log_phone ON supplier_contact_log(phone, created_at DESC)`
];
var GROUPS = [
  { key: "new_home", label: "New home" },
  { key: "remodel", label: "Remodel / addition" },
  { key: "adu", label: "ADU / guest house" },
  { key: "reroof", label: "Re-roof" },
  { key: "accessory", label: "Accessory structure" },
  { key: "multifamily", label: "Duplex / apartment" },
  { key: "site_work", label: "Demolition, grading, foundation" },
  { key: "other", label: "Other residential" },
  { key: "commercial", label: "Commercial" }
];
var GROUP_KEYS = GROUPS.map((g) => g.key);
var GROUP_LABELS = Object.fromEntries(GROUPS.map((g) => [g.key, g.label]));
var filled = /* @__PURE__ */ __name((column) => `COALESCE(${column}, '') != ''`, "filled");
var KNOWN = `(${filled("county_prospect_id")} OR ${filled("mail_pilot_ref")})`;
var SEGMENT_NAMES = Object.fromEntries(SEGMENTS.map((seg) => [seg.key, seg.name]));

// ../../functions/internal/_lib/skip-trace-calls.mjs
var CALL_HEADERS = ["Call ID", "Lead ID", "Session ID", "Caller", "Call date and time", "Number dialed", "Outcome", "Homeowner name", "Best phone", "Property address", "City and ZIP", "Project type", "Main concern", "Scope and quantity", "Preferences", "Project timing", "Estimator questions", "Appointment status", "Appointment requested for", "Follow-up permission", "Follow-up date", "Assigned to", "Handoff details", "Notes", "Approved to sync", "Sync status", "Synced at"];
var OUTCOMES = { "No answer": "attempted", "Voicemail": "attempted", "Connected": "connected", "Interested": "interested", "Not interested": "not_interested", "Wrong number": "researching", "Do not contact": "do_not_contact" };
var CALL_DDL = `CREATE TABLE IF NOT EXISTS skip_trace_calls (call_id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)`;
function parseCall(row) {
  if (row[24] !== "Yes") return null;
  const values = Array.from({ length: 24 }, (_, i) => String(row[i] ?? "").trim());
  if (values.some((v) => v.length > 2e3) || JSON.stringify(values).length > 14e3) throw Error("Call fields are too long");
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(values[0]) || !/^[a-zA-Z0-9_-]{1,100}$/.test(values[1])) throw Error("Supply a unique Call ID and exact Lead ID");
  if (!["Keith", "Robert"].includes(values[3]) || !Object.hasOwn(OUTCOMES, values[6])) throw Error("Check caller and outcome");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(values[4]) || !Number.isFinite(Date.parse(values[4]))) throw Error("Use an ISO call time including timezone");
  if (new Date(values[4].slice(0, 10)).toISOString().slice(0, 10) !== values[4].slice(0, 10) || Number(values[4].slice(11, 13)) > 23 || Number(values[4].slice(14, 16)) > 59) throw Error("Invalid call date or time");
  if (values[20] && (!/^\d{4}-\d{2}-\d{2}$/.test(values[20]) || !Number.isFinite(Date.parse(values[20])) || new Date(values[20]).toISOString().slice(0, 10) !== values[20])) throw Error("Use a valid YYYY-MM-DD follow-up date");
  const phone = values[5].replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(phone)) throw Error("Check the number dialed");
  return { id: values[0], leadId: values[1], status: OUTCOMES[values[6]], phone, values, payload: JSON.stringify(values) };
}
__name(parseCall, "parseCall");
async function applyCall(db, call, expectedVersion, now = (/* @__PURE__ */ new Date()).toISOString()) {
  await ensureSkipTables(db);
  await db.prepare(CALL_DDL).run();
  const previous = await db.prepare("SELECT payload FROM skip_trace_calls WHERE call_id=?").bind(call.id).first();
  if (previous) {
    if (previous.payload !== call.payload) throw Error("Call ID already used with different details");
    return { replayed: true };
  }
  const current = await db.prepare("SELECT * FROM skip_trace_prospects WHERE id=?").bind(call.leadId).first();
  if (!current) throw Error("Lead ID not found");
  if (!Number.isInteger(expectedVersion) || current.version !== expectedVersion) throw Error("Conflict: review newer Command Center details");
  const enrich = await db.prepare("SELECT data_json FROM skip_trace_enrichment WHERE prospect_id=?").bind(call.leadId).first();
  if (call.status !== "do_not_contact" && propertyEligibility(enrich ? JSON.parse(enrich.data_json) : null).status !== "eligible") throw Error("Property hold: review this call manually");
  if (current.status === "do_not_contact" && call.status !== "do_not_contact") throw Error("Do-not-contact cannot be removed");
  const details = call.values.map((v, i) => v && i >= 2 && i !== 20 ? `${CALL_HEADERS[i]}: ${v}` : "").filter(Boolean).join("\n");
  const notes = [current.notes, `[Call ${call.id}]
${details}`].filter(Boolean).join("\n\n");
  if (notes.length > 4e3) throw Error("Notes need review before appending this call");
  for (const sql of CONTACT_DDL) await db.prepare(sql).run();
  const phones = call.status === "do_not_contact" ? [.../* @__PURE__ */ new Set([call.phone, ...JSON.parse(current.data_json).phones.filter((p) => p.valid).map((p) => p.number)])] : [];
  const result = await db.batch([
    db.prepare("INSERT INTO skip_trace_calls (call_id,prospect_id,payload,created_at) SELECT ?,?,?,? FROM skip_trace_prospects WHERE id=? AND version=?").bind(call.id, call.leadId, call.payload, now, call.leadId, expectedVersion),
    db.prepare("UPDATE skip_trace_prospects SET status=?,notes=?,follow_up=?,version=version+1,updated_at=? WHERE id=? AND version=? AND EXISTS (SELECT 1 FROM skip_trace_calls WHERE call_id=? AND created_at=?)").bind(call.status, notes, call.values[20] || current.follow_up, now, call.leadId, expectedVersion, call.id, now),
    db.prepare("INSERT INTO skip_trace_history (prospect_id,status,notes,follow_up,created_at) SELECT id,status,notes,follow_up,updated_at FROM skip_trace_prospects WHERE id=? AND version=? AND updated_at=?").bind(call.leadId, expectedVersion + 1, now),
    ...phones.map((phone) => db.prepare("INSERT OR IGNORE INTO supplier_contact_blocks (phone,reason,note,created_at) SELECT ?, 'asked_not_to_call', 'Call log removal request', ? FROM skip_trace_prospects WHERE id=? AND version=? AND updated_at=? AND status='do_not_contact'").bind(phone, now, call.leadId, expectedVersion + 1, now))
  ]);
  if (!result[1].meta.changes) throw Error("Conflict: record changed while saving");
  return { version: expectedVersion + 1, notes, follow_up: call.values[20] || current.follow_up, status: call.status, updated_at: now };
}
__name(applyCall, "applyCall");

// src/index.mjs
var PROSPECT_HEADERS = ["Lead ID", "Homeowner", "Property address", "City", "ZIP", "Calling eligibility", "Status", "Assigned to", "Follow-up date", "Current notes", "Year built", "Property hold reason", "Source batch", "Record version", "Last updated", "Sync status"];
var PHONE_HEADERS = ["Homeowner", "Phone number", "Phone restriction", "Property eligibility", "Lead ID", "Phone type", "Registry checked on", "Phone-owner verified on", "Verification source", "Approved to call"];
async function syncCalls(env, fetchImpl = fetch) {
  if (env.CALLING_SYNC_ENABLED !== "true") return { enabled: false };
  const account = accountConfig(env.CALLING_GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!account || !env.QUOTES_DB || !/^[\w-]{20,100}$/.test(env.CALLING_SHEET_ID || "")) throw Error("Calling sync configuration missing");
  const token = await googleToken(account, "https://www.googleapis.com/auth/spreadsheets", fetchImpl);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${env.CALLING_SHEET_ID}`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const read = /* @__PURE__ */ __name((range) => googleJson(`${base}/values/${encodeURIComponent(range)}`, { headers }, fetchImpl), "read");
  const write = /* @__PURE__ */ __name((data) => googleJson(`${base}/values:batchUpdate`, { method: "POST", headers, body: JSON.stringify({ valueInputOption: "RAW", data }) }, fetchImpl), "write");
  const [log, source, phones] = await Promise.all([read("'Call log'!A1:AA1000"), read("'Prospects'!A1:P1000"), read("'Phone review'!A1:J1000")]);
  if (JSON.stringify(log.values?.[0]) !== JSON.stringify(CALL_HEADERS)) throw Error("Call log headers changed");
  if (JSON.stringify(source.values?.[0]) !== JSON.stringify(PROSPECT_HEADERS)) throw Error("Prospects headers changed");
  if (JSON.stringify(phones.values?.[0]) !== JSON.stringify(PHONE_HEADERS)) throw Error("Phone review headers changed");
  const versions = /* @__PURE__ */ new Map();
  for (const row of (source.values || []).slice(1)) {
    if (versions.has(row[0])) throw Error("Duplicate prospect IDs in workbook");
    versions.set(row[0], Number(row[13]));
  }
  const rows = (log.values || []).slice(1);
  const counts = /* @__PURE__ */ new Map();
  for (const row of rows) if (row[0]) counts.set(row[0], (counts.get(row[0]) || 0) + 1);
  let saved = 0, errors = 0;
  if (rows.length >= 999) throw Error("Call log capacity reached; archive completed sessions");
  for (let i = 0, processed = 0; i < rows.length && processed < 20; i++) {
    const row = rows[i];
    if (row[24] !== "Yes" || row[25] === "Synced" || String(row[25] || "").startsWith("Error:")) continue;
    processed++;
    let message = "Synced", at = (/* @__PURE__ */ new Date()).toISOString();
    try {
      if (counts.get(row[0]) !== 1) throw Error("Duplicate Call ID in sheet");
      const call = parseCall(row);
      const result = await applyCall(env.QUOTES_DB, call, versions.get(call.leadId), at);
      if (result.version) versions.set(call.leadId, result.version);
      if (!result.replayed) saved++;
    } catch (error) {
      message = `Error: ${error.message}`;
      at = "";
      errors++;
    }
    const fresh = (await read(`'Call log'!A${i + 2}:AA${i + 2}`)).values?.[0] || [];
    if (JSON.stringify(fresh.slice(0, 25)) !== JSON.stringify(row.slice(0, 25))) continue;
    await write([{ range: `'Call log'!Z${i + 2}:AA${i + 2}`, values: [[message, at || row[26] || ""]] }]);
  }
  const db = env.QUOTES_DB;
  await db.prepare(CALL_DDL).run();
  const { results: prospects } = await db.prepare("SELECT p.*, e.data_json AS research_json, (SELECT payload FROM skip_trace_calls c WHERE c.prospect_id=p.id ORDER BY created_at DESC,call_id DESC LIMIT 1) AS latest_call FROM skip_trace_prospects p LEFT JOIN skip_trace_enrichment e ON e.prospect_id=p.id ORDER BY p.id LIMIT 1001").all();
  if (prospects.length > 999) throw Error("Prospect capacity exceeded");
  const values = prospects.map((p) => {
    const d = JSON.parse(p.data_json), r = p.research_json ? JSON.parse(p.research_json) : null, e = propertyEligibility(r), last = p.latest_call ? JSON.parse(p.latest_call) : null;
    return [p.id, d.name || d.ownerName || "", d.address, d.city, d.zip, e.status === "excluded" ? "Excluded" : p.status === "do_not_contact" || Object.values(d.flags || {}).some(Boolean) ? "Contact hold" : e.status === "eligible" ? "Phone review needed" : "Property hold", p.status, last?.[21] || "Unassigned", p.follow_up, p.notes, r?.yearBuilt || "", e.status === "hold" ? e.reason : "", p.batch, p.version, p.updated_at, "Current"];
  });
  const { results: blocks } = await db.prepare("SELECT phone FROM supplier_contact_blocks").all();
  const suppressed = new Set(blocks.map((p) => p.phone));
  const phoneValues = prospects.flatMap((p, index) => {
    const d = JSON.parse(p.data_json);
    return d.phones.map((phone) => [d.name || d.ownerName || "", phone.number, suppressed.has(phone.number) || p.status === "do_not_contact" ? "Company do-not-contact" : phone.dnc ? "DNC - do not call" : !phone.valid ? "Invalid number" : "Unverified - do not call", values[index][5], p.id, phone.type, "", "", "", false]);
  });
  if (phoneValues.length > 999) throw Error("Phone table capacity exceeded");
  while (values.length < (source.values?.length || 1) - 1) values.push(Array(16).fill(""));
  while (phoneValues.length < (phones.values?.length || 1) - 1) phoneValues.push(Array(10).fill(""));
  await write([{ range: `'Prospects'!A2:P${Math.max(2, values.length + 1)}`, values: values.length ? values : [Array(16).fill("")] }, { range: `'Phone review'!A2:J${Math.max(2, phoneValues.length + 1)}`, values: phoneValues.length ? phoneValues : [Array(10).fill("")] }, { range: "'Start here'!B26", values: [[`Last sync: ${(/* @__PURE__ */ new Date()).toISOString()}. ${saved} calls saved; ${errors} need review.`]] }]);
  return { enabled: true, saved, errors, prospects: values.length };
}
__name(syncCalls, "syncCalls");
var index_default = {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncCalls(env).then((r) => console.log("calling-sync", JSON.stringify(r))).catch(() => console.error("calling-sync-failed: check connection or workbook layout")));
  },
  async fetch() {
    return new Response("Not found", { status: 404 });
  }
};
export {
  PHONE_HEADERS,
  PROSPECT_HEADERS,
  index_default as default,
  syncCalls
};
//# sourceMappingURL=index.js.map
