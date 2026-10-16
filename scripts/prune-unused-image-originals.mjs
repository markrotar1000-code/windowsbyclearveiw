// Astro's cold image builds can leave full-size originals beside optimized variants.
// Remove only originals with a generated variant and no reference in any built text asset.
// Never remove a photo that a page offers as a full-size download.
import { readdir, readFile, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
async function filesUnder(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    // Build-only prerender bundles contain import metadata, not browser references.
    if (entry.isDirectory() && entry.name === '.prerender') continue;
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else files.push(path);
  }
  return files;
}
const all = await filesUnder(dist);
const text = (await Promise.all(all.filter(path => /\.(?:html|css|m?js|json|webmanifest|xml|svg|txt)$/i.test(path)).map(path => readFile(path, 'utf8')))).join('\n');
const assets = join(dist, '_astro');
const names = await readdir(assets);
let count = 0;
let bytes = 0;
for (const name of names) {
  if (!/\.(?:jpe?g|png)$/i.test(name) || text.includes(name)) continue;
  const stem = name.replace(/\.[^.]+$/, '');
  if (!names.some(variant => variant.startsWith(stem + '_') && /\.(?:webp|avif)$/i.test(variant))) continue;
  const path = join(assets, name);
  bytes += (await stat(path)).size;
  await unlink(path);
  count++;
}
console.log(`Image output: removed ${count} unreferenced originals (${(bytes / 1024 / 1024).toFixed(1)} MiB); linked originals retained.`);
