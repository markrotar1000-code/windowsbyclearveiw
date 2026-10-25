// Audio capture hardening for quote dictation: the level meter and silence warning, recordings kept on the phone until
// they are written out, and sizes spoken back. Pure logic is tested here exactly; the browser behavior (IndexedDB, the
// offline event, the meter on a real audio stream) is covered by scripts/audit-quote-dictation.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formatInches, spokenInches, spokenSize, extractSizes } from '../functions/_lib/dimensions.mjs';

process.removeAllListeners('warning');
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const pass = (m) => console.log(`PASS: ${m}`);
const level = await import(new URL('src/lib/audio-level.ts', root).href);
const clips = await import(new URL('src/lib/clip-store.ts', root).href);

// 1. Loudness and the silence watcher.
{
  assert.equal(level.rmsOfBytes([]), 0);
  assert.equal(level.rmsOfBytes(new Uint8Array(1024).fill(128)), 0, 'a flat line is silence');
  const loud = Uint8Array.from({ length: 1024 }, (_, i) => (i % 2 ? 255 : 1));
  assert.ok(level.rmsOfBytes(loud) > 0.9, 'a full-scale signal is loud');
  assert.ok(level.rmsOfBytes(Uint8Array.from({ length: 1024 }, (_, i) => 128 + Math.round(20 * Math.sin(i / 5)))) > 0.08, 'ordinary speech registers');
  assert.equal(level.meterFill(0), 0); assert.equal(level.meterFill(1), 1); assert.ok(level.meterFill(0.1) > 0.4 && level.meterFill(0.1) < 0.6, 'quiet speech still moves the bar');

  const watch = level.createSilenceWatch({ floor: 0.012, afterMs: 6000 });
  assert.equal(watch.feed(0.2, 0), null, 'sound is fine');
  assert.equal(watch.feed(0.001, 1000), null, 'a short pause is not a warning');
  assert.equal(watch.feed(0.001, 6999), null, 'just under six seconds of quiet');
  assert.equal(watch.feed(0.001, 7000), 'silent', 'six seconds of quiet warns');
  assert.equal(watch.feed(0.001, 9000), null, 'it warns once, not on every frame');
  assert.equal(watch.feed(0.2, 9500), 'recovered', 'and says when sound returns');
  assert.equal(watch.feed(0.001, 9600), null); assert.equal(watch.feed(0.001, 15700), 'silent', 'a new silence warns again');
  pass('the meter reads loudness and the watcher warns once after six seconds of silence, and again only after sound returns');
}

// 2. Which saved recordings are kept.
{
  const now = 100 * 3600_000;
  const clip = (at, size = 50_000) => ({ at, blob: { size } });
  const rows = [clip(now - 13 * 3600_000), clip(now - 3600_000), clip(now - 2 * 3600_000), clip(now - 60_000, 0), clip(now - 120_000, clips.MAX_CLIP_BYTES + 1)];
  const { keep, drop } = clips.pruneClips(rows, now);
  assert.equal(keep.length, 2, 'older than 12 hours, empty and over-size clips are dropped');
  assert.ok(keep[0].at < keep[1].at, 'kept oldest first, so they are written out in the order recorded');
  assert.equal(drop.length, 3);
  const many = Array.from({ length: 20 }, (_, i) => clip(now - (20 - i) * 1000));
  const capped = clips.pruneClips(many, now);
  assert.equal(capped.keep.length, clips.MAX_CLIPS); assert.equal(capped.keep.at(-1).at, many.at(-1).at, 'the newest are the ones kept');
  assert.equal(clips.MAX_AGE_MS, 12 * 3600_000);
  pass('stale, empty and oversized saved recordings are dropped, the newest twelve are kept in recorded order');
}

// 3. Sizes said aloud.
{
  const said = (text) => spokenSize(extractSizes(text)[0]);
  assert.equal(said('35 1/2 x 47 3/4'), '35 and a half by 47 and three quarters');
  assert.equal(said('36 x 48'), '36 by 48');
  assert.equal(said('23 7/8 x 35 5/8'), '23 and seven eighths by 35 and five eighths');
  assert.equal(said('71 1/4 x 59 1/8'), '71 and a quarter by 59 and an eighth');
  assert.equal(said('47 5/16 x 23 1/16'), '47 and five sixteenths by 23 and a sixteenth');
  assert.equal(spokenInches(8), 'a half'); assert.equal(spokenInches(0), '0');
  // Round trip: what is spoken back reads as the same size when said again.
  for (const text of ['35 1/2 x 47 3/4', '23 7/8 x 35 5/8', '71 1/4 x 59 1/8', '47 5/16 x 23 1/16', '36 x 48']) {
    const size = extractSizes(text)[0];
    const again = extractSizes(spokenSize(size))[0];
    assert.deepEqual([again.w, again.h], [size.w, size.h], `${text} said aloud means the same size`);
  }
  for (let v = 96; v <= 2304; v += 7) assert.equal(extractSizes(`${formatInches(v)} x 48`)[0].w, v, `${formatInches(v)} survives a round trip`);
  pass('sizes are spoken the way a person says them, and what is said reads back as the same size');
}

// 4. The page keeps the promises it makes.
{
  const page = read('src/pages/internal/quotes/new.astro');
  assert.match(page, /saveClip\(blob\)/, 'a clip is saved before it is sent');
  assert.match(page, /void deleteClip\(id\)/, 'and deleted once written out');
  assert.match(page, /window\.addEventListener\('online'/, 'it sends what was waiting when the signal returns');
  assert.match(page, /retryable === false/, 'a clip that cannot be sent (too long) is not kept forever');
  assert.match(page, /data-discard-clips/); assert.match(page, /discardAllClips\(\)/);
  assert.match(page, /they may belong to a different quote|never sent on their own/, 'old recordings are offered, not sent on their own');
  assert.match(page, /createSilenceWatch/); assert.match(page, /I am not hearing anything/);
  assert.match(page, /data-speak-sizes/); assert.match(page, /speakSizes\(sizes\)/);
  assert.match(page, /!speakBox\.checked \|\| recording/, 'sizes are never spoken while the microphone is on');
  assert.match(page, /Audio is never kept on our servers/, 'the page says plainly where audio lives');
  const endpoint = read('functions/internal/api/quote-dictation.js').replace(/\/\/.*$/gm, '');
  assert.ok(!/R2|JOB_PHOTOS|\.put\(|INSERT/.test(endpoint), 'the server still never stores audio');
  const store = read('src/lib/clip-store.ts');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(store), 'saved clips never leave the phone from the store');
  pass('the page saves, sends, deletes and discards recordings as it says, and never speaks over the microphone');
}

console.log('\nAll audio capture checks passed.');
