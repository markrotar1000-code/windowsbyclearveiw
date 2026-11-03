import { loadFailureMessage } from './load-failed';
export function bindDraftRecovery(form: HTMLFormElement, identity: string, read: () => any, restore: (draft: any) => void) {
  const key = `cv-full-quote-draft:${identity}`;
  const box = document.createElement('section'); box.className = 'qb-draft-recovery'; box.setAttribute('aria-label', 'Quote draft recovery');
  const message = document.createElement('p'); message.setAttribute('role', 'status');
  const recover = document.createElement('button'); recover.type = 'button'; recover.className = 'btn btn-ghost'; recover.textContent = 'Restore saved draft';
  const discard = document.createElement('button'); discard.type = 'button'; discard.className = 'btn btn-ghost'; discard.textContent = 'Discard saved draft';
  box.append(message, recover, discard); form.before(box);
  let pending: any = null, paused = false, timer: ReturnType<typeof setTimeout>;
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null');
    if (stored?.schema === 1 && stored.identity === identity && Date.now() - stored.at < 86400000 && stored.state && Array.isArray(stored.state.items)) pending = stored.state;
    else localStorage.removeItem(key);
  } catch {}
  function label() {
    recover.hidden = discard.hidden = !pending;
    message.textContent = pending ? 'An unsaved quote draft is available from this device. Restore it or discard it before continuing.' : 'Quote recovery is saved on this device as you work. Save & continue saves to the Command Center.';
  }
  label();
  function save() {
    if (pending || paused) return;
    try {
      const json = JSON.stringify({ schema: 1, identity, at: Date.now(), state: read() });
      if (json.length > 300000) { message.textContent = 'This draft is too large for local recovery. Save it to the Command Center.'; return; }
      localStorage.setItem(key, json); message.textContent = 'Draft saved on this device. Save & continue saves to the Command Center.';
    } catch { message.textContent = 'Device recovery is unavailable. Use Save & continue to preserve your quote.'; }
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(save, 200); };
  form.addEventListener('input', schedule); form.addEventListener('change', schedule); form.addEventListener('click', schedule);
  const hidden = () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); save(); } };
  document.addEventListener('visibilitychange', hidden);
  recover.addEventListener('click', () => {
    if (!pending || form.querySelector('button[type="submit"]:disabled')) return;
    try { restore(pending); pending = null; label(); save(); } catch (error) { message.textContent = loadFailureMessage(error, 'The saved draft could not be restored. Discard it to continue.'); }
  });
  discard.addEventListener('click', () => { localStorage.removeItem(key); pending = null; label(); });
  return { clear() { paused = true; clearTimeout(timer); localStorage.removeItem(key); document.removeEventListener('visibilitychange', hidden); }, flush: save };
}
