import { ensureJobsSchema } from './jobs-schema.mjs';
const ready=new WeakSet();
export async function ensurePaymentInvoiceGuards(db){
 if(ready.has(db))return;
 await ensureJobsSchema(db);
 await db.prepare(`CREATE TABLE IF NOT EXISTS job_payments (id INTEGER PRIMARY KEY AUTOINCREMENT,job_id TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,amount_paid_cents INTEGER NOT NULL DEFAULT 0,payment_method TEXT,notes TEXT)`).run();
 await db.prepare('CREATE TABLE IF NOT EXISTS invoice_finance_guards (id TEXT PRIMARY KEY,invoice_id TEXT,quote_id TEXT,mode TEXT NOT NULL)').run();
 await db.prepare(`CREATE TRIGGER IF NOT EXISTS invoice_no_payment_guard BEFORE INSERT ON invoice_finance_guards
 WHEN NEW.mode='unpaid' AND EXISTS (SELECT 1 FROM jobs j JOIN job_payments p ON p.job_id=j.id WHERE j.quote_id=(SELECT quote_id FROM invoices WHERE id=NEW.invoice_id) AND p.amount_paid_cents>0)
 BEGIN SELECT RAISE(ABORT,'INVOICE_HAS_PAYMENTS'); END`).run();
 await db.prepare(`CREATE TRIGGER IF NOT EXISTS invoice_payment_void_guard BEFORE INSERT ON invoice_finance_guards
 WHEN NEW.mode='payment' AND EXISTS (SELECT 1 FROM invoices WHERE quote_id=NEW.quote_id AND status='void')
 BEGIN SELECT RAISE(ABORT,'INVOICE_VOID_CONFLICT'); END`).run();
 ready.add(db);
}
export async function guardedInvoiceFinanceBatch(db,{invoiceId=null,quoteId=null,mode},statements){
 await ensurePaymentInvoiceGuards(db);
 const id=crypto.randomUUID();
 return db.batch([db.prepare('INSERT INTO invoice_finance_guards(id,invoice_id,quote_id,mode) VALUES (?,?,?,?)').bind(id,invoiceId,quoteId,mode),...statements,db.prepare('DELETE FROM invoice_finance_guards WHERE id=?').bind(id)]);
}
