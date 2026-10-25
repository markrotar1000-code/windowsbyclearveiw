// A recording that could not be sent (no signal in a basement, a dropped connection, an expired sign-in) must not be
// lost when the page reloads or the phone locks: the words Mark said at a window are not something he can repeat.
// Unsent clips wait here, on this phone only, in the browser's own database; they are deleted the moment they are
// written out or discarded, and after 12 hours regardless. Audio is never stored on our servers.

export type StoredClip = { id: number; at: number; type: string; blob: Blob };

const DB = 'clearview-quote-clips';
const STORE = 'clips';
export const MAX_CLIPS = 12;
export const MAX_AGE_MS = 12 * 3600_000;
export const MAX_CLIP_BYTES = 1_500_000;

/** What to keep: recent clips only, oldest first, at most MAX_CLIPS (the newest win), each within the server's size limit. */
export function pruneClips<T extends { at: number; blob: { size: number } }>(rows: T[], now: number): { keep: T[]; drop: T[] } {
  const fresh = rows.filter((r) => now - r.at < MAX_AGE_MS && r.blob.size > 0 && r.blob.size <= MAX_CLIP_BYTES).sort((a, b) => a.at - b.at);
  const keep = fresh.slice(Math.max(0, fresh.length - MAX_CLIPS));
  return { keep, drop: rows.filter((r) => !keep.includes(r)) };
}

// This is the only code that opens this database, and it creates its store when the database is created. If a database
// ever exists without the store (an interrupted upgrade in an odd browser), the browser would never upgrade it again and
// every save would fail, so it is deleted (it only holds unsent clips) and created fresh, once.
const openOnce = (): Promise<IDBDatabase | null> => new Promise((resolve) => {
  try {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  } catch { resolve(null); }
});

const open = async (): Promise<IDBDatabase | null> => {
  const db = await openOnce();
  if (!db || db.objectStoreNames.contains(STORE)) return db;
  db.close();
  await new Promise<void>((resolve) => { try { const del = indexedDB.deleteDatabase(DB); del.onsuccess = del.onerror = del.onblocked = () => resolve(); } catch { resolve(); } });
  const fresh = await openOnce();
  return fresh && fresh.objectStoreNames.contains(STORE) ? fresh : null;
};

const done = (tx: IDBTransaction) => new Promise<boolean>((resolve) => { tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); tx.onabort = () => resolve(false); });

/** Saves a clip and returns its id, or null when this browser will not store it (a private window): the clip is then only in memory. */
export async function saveClip(blob: Blob, now = Date.now()): Promise<number | null> {
  const db = await open();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const request = tx.objectStore(STORE).add({ at: now, type: blob.type, blob });
    const id = await new Promise<number | null>((resolve) => { request.onsuccess = () => resolve(Number(request.result)); request.onerror = () => resolve(null); });
    await done(tx);
    return id;
  } catch { return null; } finally { db.close(); }
}

export async function deleteClip(id: number): Promise<void> {
  const db = await open();
  if (!db) return;
  try { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); await done(tx); } catch { /* nothing to delete */ } finally { db.close(); }
}

/** Every clip still waiting, oldest first; anything stale or over the cap is deleted on the way. */
export async function waitingClips(now = Date.now()): Promise<StoredClip[]> {
  const db = await open();
  if (!db) return [];
  try {
    const rows = await new Promise<StoredClip[]>((resolve) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result as StoredClip[]);
      request.onerror = () => resolve([]);
    });
    const { keep, drop } = pruneClips(rows, now);
    if (drop.length) { const tx = db.transaction(STORE, 'readwrite'); drop.forEach((r) => tx.objectStore(STORE).delete(r.id)); await done(tx); }
    return keep;
  } catch { return []; } finally { db.close(); }
}

export async function discardAllClips(): Promise<void> {
  const db = await open();
  if (!db) return;
  try { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); await done(tx); } catch { /* already empty */ } finally { db.close(); }
}
