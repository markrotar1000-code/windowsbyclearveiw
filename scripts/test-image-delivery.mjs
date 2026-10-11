// Guards how photos are delivered and framed. Run after `npm run build` (it reads dist/).
//
// Found 2026-10-10 by measuring every <img> in a real browser at 1440 px, 1440 px at 2x and a 3x phone:
//   - landscape photos in 3:4 tiles were downloaded at tile width and stretched up to 1.75x (soft), and
//     lost up to half the building to the crop;
//   - single-column phone tiles were asked for at 45vw while rendering at 87vw (0.67x);
//   - the home hero's final photo was one 1200 px file on screens that need 2000-2900 px (0.42-0.63x).
// Fixed in src/lib/image-sizes.ts, WorkCard and the pages. This test keeps the rules and keeps one trap shut:
// reading a photo's width or height directly publishes its full-size original (71 MB in dist/_astro).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const lib = await import(pathToFileURL(`${root}src/lib/image-sizes.ts`).href);
const { FRAMES, SLOT_SIZES, LEAD_PHOTO_WIDTHS, TILE_WIDTHS, CROPPED_TILE_WIDTHS, HARD_CROP, coverScale, scaleSizes, tileSizes, tileWidths, frameForGroup, isLandscape, dimensionsOf } = lib;

let groups = 0;
const ok = (name, fn) => {
  try {
    fn();
  } catch (error) {
    error.message = `[${name}] ${error.message}`;
    throw error;
  }
  groups++;
};

// ── coverScale: how much wider than the tile the file must be ───────────────────────────────
ok('coverScale', () => {
  const siding = { width: 4096, height: 3089 };
  const portrait = { width: 3072, height: 4096 };
  assert.equal(coverScale(portrait, FRAMES.portrait), 1, 'a portrait photo in a portrait frame is width-limited');
  assert.equal(coverScale(portrait, FRAMES.square), 1, 'a portrait photo in a square frame is width-limited');
  assert.equal(coverScale(portrait, FRAMES.landscape), 1, 'a portrait photo in a landscape frame is width-limited');
  assert.equal(coverScale(siding, FRAMES.portrait), 1.77, '4:3 photo in a 3:4 frame is height-limited: 1.326 / 0.75, rounded up');
  assert.ok(coverScale(siding, FRAMES.landscape) < 1.01, 'the same photo in a landscape frame needs no extra width');
  assert.equal(coverScale(siding, FRAMES.square), 1.33);
  for (const bad of [{ width: 0, height: 10 }, { width: 10, height: 0 }, { width: NaN, height: 5 }]) assert.equal(coverScale(bad, 0.75), 1, 'bad dimensions fall back to 1');
  assert.equal(coverScale(siding, 0), 1);
});

// ── scaleSizes ──────────────────────────────────────────────────────────────────────────────
ok('scaleSizes', () => {
  assert.equal(scaleSizes(SLOT_SIZES.threeAcross, 1), SLOT_SIZES.threeAcross, 'factor 1 changes nothing');
  assert.equal(scaleSizes(SLOT_SIZES.threeAcross, 0.5), SLOT_SIZES.threeAcross, 'a factor below 1 changes nothing');
  assert.equal(
    scaleSizes('(max-width: 560px) 45vw, 450px', 2),
    '(max-width: 560px) calc(45vw * 2), calc(450px * 2)',
    'every slot, including the last, is scaled and every media condition survives',
  );
  assert.equal(
    scaleSizes(SLOT_SIZES.autoFill, 1.5),
    '(max-width: 546px) calc(calc(100vw - 51px) * 1.5), calc(320px * 1.5)',
    'a calc() slot nests inside calc() and its inner comma-free parentheses are not split',
  );
  assert.equal(scaleSizes('450px', 1.2), 'calc(450px * 1.2)', 'a bare length works');
  // The output is a legal `sizes` list: every entry is `(media) length` except the last.
  for (const [name, list] of Object.entries(SLOT_SIZES)) {
    for (const factor of [1, 1.77, 2.07]) {
      const entries = scaleSizes(list, factor).split(/,\s*(?![^()]*\))/);
      entries.forEach((entry, index) => {
        const last = index === entries.length - 1;
        assert.ok(last ? !/^\(/.test(entry) : /^\(max-width: \d+px\) \S/.test(entry), `${name} x${factor}: bad entry "${entry}"`);
      });
    }
  }
});

// ── frames, widths, and the properties of the measured presets ──────────────────────────────
ok('frames', () => {
  const land = { image: { width: 4096, height: 3072 } };
  const port = { image: { width: 3072, height: 4096 } };
  assert.equal(frameForGroup([land, land]), 'landscape');
  assert.equal(frameForGroup([land, port]), 'portrait', 'a mixed group keeps the standard frame: mixed shapes look ragged');
  assert.equal(frameForGroup([port]), 'portrait');
  assert.equal(frameForGroup([]), 'portrait');
  assert.equal(isLandscape({ width: 5, height: 4 }), true);
  assert.equal(isLandscape({ width: 4, height: 4 }), false, 'square is not landscape');
  assert.ok(Math.abs(FRAMES.portrait * FRAMES.landscape - 1) < 1e-9, 'landscape is portrait turned on its side');
});

ok('widths', () => {
  const ascending = (list) => list.every((value, index) => index === 0 || value > list[index - 1]);
  assert.ok(ascending(TILE_WIDTHS) && ascending(CROPPED_TILE_WIDTHS));
  assert.ok(TILE_WIDTHS.includes(1200), 'a full-width phone tile at 3x needs about 1000-1140 px');
  assert.ok(Math.max(...CROPPED_TILE_WIDTHS) >= 2000, 'a hard-cropped photo at 2x needs about 1900 px');
  assert.deepEqual(tileWidths(1), TILE_WIDTHS);
  assert.deepEqual(tileWidths(HARD_CROP), TILE_WIDTHS);
  assert.deepEqual(tileWidths(1.77), CROPPED_TILE_WIDTHS);
  // A 3 x phone fills a 339 px slot with 1017 px; no preset may cap below that.
  assert.ok(Math.max(...TILE_WIDTHS) >= 1017);
  // Measured slot widths (docs/IMAGE-DELIVERY.md): single column up to 546 px on the auto-fill grid.
  assert.match(SLOT_SIZES.autoFill, /^\(max-width: 546px\) calc\(100vw - 51px\), 3\d\dpx$/);
  // A lead photo is 800 px wide on a laptop; at 2x it needs 1600 px, so the list must reach past 1600.
  assert.ok(ascending(LEAD_PHOTO_WIDTHS) && Math.max(...LEAD_PHOTO_WIDTHS) >= 1800);
  assert.match(SLOT_SIZES.leadPhoto, /^\(max-width: 900px\) 100vw, 8\d\dpx$/);
  assert.match(SLOT_SIZES.guideGraphic, /^\(max-width: 1280px\) calc\(100vw - 100px\), 1180px$/);
});

ok('dimensionsOf reads through .clone and never touches width/height on a proxy', () => {
  // Astro's imported photo is a Proxy: reading `width` on it marks the original for publishing.
  const guarded = new Proxy(
    { width: 4096, height: 3089, clone: { width: 4096, height: 3089 } },
    {
      get(target, key) {
        if (key === 'clone') return target.clone;
        throw new Error(`direct read of image.${String(key)} would publish the original`);
      },
    },
  );
  assert.deepEqual(dimensionsOf(guarded), { width: 4096, height: 3089 });
  assert.equal(coverScale(guarded, 0.75), 1.77);
  assert.equal(frameForGroup([{ image: guarded }]), 'landscape');
  assert.equal(tileSizes('450px', guarded, 'portrait'), 'calc(450px * 1.77)');
  assert.deepEqual(dimensionsOf({ width: 3, height: 4 }), { width: 3, height: 4 }, 'plain objects work too');
});

// ── source guards ───────────────────────────────────────────────────────────────────────────
function* walk(dir, extensions) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path, extensions);
    else if (extensions.some((extension) => name.endsWith(extension))) yield path;
  }
}
const rel = (path) => relative(root, path).replaceAll('\\', '/');

ok('no component reads a photo size directly', () => {
  const offenders = [];
  for (const file of walk(join(root, 'src'), ['.astro', '.ts'])) {
    if (rel(file) === 'src/lib/image-sizes.ts') continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\b(?:image|photo|hero\w*|poster\w*)\.(?:image\.)?(width|height|format)\b/g)) {
      // `.clone.width` is the safe form; only a direct read is flagged.
      if (!/\.clone\./.test(match[0])) offenders.push(`${rel(file)}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], 'Read sizes with dimensionsOf()/coverScale() from src/lib/image-sizes.ts. A direct read of an imported photo\'s width/height copies its full-size original into dist/_astro.');
});

ok('every WorkCard declares measured slot sizes', () => {
  const missing = [];
  for (const file of walk(join(root, 'src/pages'), ['.astro'])) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/<WorkCard\b[\s\S]*?\/>/g)) {
      const tag = match[0];
      const declared = /\bsizes=\{(?:SLOT_SIZES\.\w+|group\.sizes)\}/.test(tag);
      // The home page's three-across grid is the component's default (SLOT_SIZES.threeAcross).
      if (!declared && rel(file) !== 'src/pages/index.astro') missing.push(rel(file));
      if (/\bsizes="/.test(tag)) missing.push(`${rel(file)} (hand-written sizes string: use a SLOT_SIZES preset)`);
    }
  }
  assert.deepEqual(missing, [], 'A WorkCard without a measured `sizes` falls back to the three-across default and is downloaded too small on a phone.');
});

// ── the built site ──────────────────────────────────────────────────────────────────────────
const dist = join(root, 'dist');
assert.ok(existsSync(dist), 'dist/ not found. Run `npm run build` before `npm run test:image-delivery`.');
const pages = new Map();
for (const file of walk(dist, ['.html'])) {
  if (rel(file).startsWith('dist/internal/')) continue;
  pages.set(rel(file).replace(/^dist\//, '').replace(/\.html$/, ''), readFileSync(file, 'utf8'));
}
const images = (html) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
// Astro prints an empty attribute value as a bare attribute (`alt` for alt=""), which is valid HTML.
const attr = (tag, name) => {
  const match = new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s/>])`).exec(tag);
  return match ? (match[1] ?? '') : undefined;
};
const widestCandidate = (tag) => Math.max(0, ...[...(attr(tag, 'srcset') ?? '').matchAll(/\s(\d+)w\b/g)].map((m) => Number(m[1])));

ok('no original photo is published unused', () => {
  const astroDir = join(dist, '_astro');
  const used = [...pages.values()].join('\n');
  const orphans = readdirSync(astroDir).filter((name) => /\.(jpe?g|png)$/i.test(name) && !used.includes(name));
  assert.deepEqual(orphans, [], `${orphans.length} full-size original(s) are in dist/_astro but no page links to them. Something read an imported photo's width/height or src directly.`);
});

ok('every image has alt text, and tiles have srcset + sizes', () => {
  for (const [page, html] of pages) {
    for (const tag of images(html)) {
      assert.notEqual(attr(tag, 'alt'), undefined, `${page}: <img> without alt: ${tag.slice(0, 90)}`);
    }
    for (const figure of html.matchAll(/<figure class="work-card[^"]*"[^>]*>[\s\S]*?<\/figure>/g)) {
      const [tag] = images(figure[0]);
      assert.ok(tag && attr(tag, 'srcset') && attr(tag, 'sizes'), `${page}: a work-card without srcset and sizes`);
      assert.ok(widestCandidate(tag) >= 1200, `${page}: a work-card tops out below 1200 px`);
    }
  }
});

ok('all-landscape groups use the landscape frame, and hard-cropped photos get large candidates', () => {
  for (const page of ['siding', 'new-construction']) {
    const frames = [...pages.get(page).matchAll(/<figure class="work-card[^"]*"[^>]*data-frame="(\w+)"/g)].map((m) => m[1]);
    assert.ok(frames.length > 0, `${page}: no work cards found`);
    assert.ok(frames.every((frame) => frame === 'landscape'), `${page}: expected every tile landscape, got ${frames.join(',')}`);
  }
  const gallery = pages.get('gallery');
  const siding = /id="siding"[\s\S]*?<\/section>/.exec(gallery)?.[0] ?? '';
  assert.ok(/data-frame="landscape"/.test(siding) && !/data-frame="portrait"/.test(siding), 'the gallery siding group should be all landscape');
  const interiors = /id="interiors"[\s\S]*?<\/section>/.exec(gallery)?.[0] ?? '';
  assert.ok(/data-frame="square"/.test(interiors) && !/data-frame="portrait"/.test(interiors), 'the gallery interior group should be square');
  // A landscape photo left in a portrait frame (the mixed home grid) must still be downloaded wide enough.
  for (const [page, html] of pages) {
    for (const figure of html.matchAll(/<figure class="work-card[^"]*"[^>]*data-frame="portrait"[\s\S]*?<\/figure>/g)) {
      const [tag] = images(figure[0]);
      if (/calc\([^)]*\) \* [\d.]+\)/.test(attr(tag, 'sizes') ?? '') || /calc\(\d+px \* [\d.]+\)/.test(attr(tag, 'sizes') ?? '')) {
        assert.ok(widestCandidate(tag) >= 2000, `${page}: a hard-cropped tile has no 2000 px candidate`);
      }
    }
  }
});

ok('the home hero photo is offered up to 2560 px', () => {
  const [tag] = images(pages.get('index')).filter((tag) => /class="hero-static"/.test(tag));
  assert.ok(tag, 'hero-static image not found');
  assert.ok(widestCandidate(tag) >= 2560, 'hero-static needs a 2560 px candidate for retina laptops and phones');
  assert.match(attr(tag, 'sizes') ?? '', /\(max-width: 640px\) \d+vw, 100vw/);
  assert.equal(attr(tag, 'fetchpriority'), 'low', 'the settle-on photo must not compete with the video and poster');
});

ok('photo-guide lead photos and guide graphics are offered past 1600 px', () => {
  let leads = 0;
  let graphics = 0;
  for (const [page, html] of pages) {
    for (const wrap of html.matchAll(/<div class="photo-wrap[^"]*"[^>]*>[\s\S]*?<\/div>/g)) {
      const [tag] = images(wrap[0]);
      // The stock-photo guides use a plain <img> with no srcset; only the job photos are responsive.
      if (!tag || !attr(tag, 'srcset')) continue;
      leads++;
      assert.ok(widestCandidate(tag) >= 1800, `${page}: a lead photo tops out below 1800 px (an 800 px tile at 2x needs 1600)`);
      assert.equal(attr(tag, 'sizes'), SLOT_SIZES.leadPhoto, `${page}: lead photo sizes drifted from SLOT_SIZES.leadPhoto`);
    }
    for (const tag of images(html).filter((entry) => /class="guide-image"/.test(entry))) {
      graphics++;
      assert.ok(widestCandidate(tag) >= 2000, `${page}: the guide graphic tops out below 2000 px (shown 1180 px wide; 2x needs 2360)`);
      assert.equal(attr(tag, 'sizes'), SLOT_SIZES.guideGraphic, `${page}: guide graphic sizes drifted from SLOT_SIZES.guideGraphic`);
    }
  }
  assert.ok(leads >= 4, `expected the photo guide on at least 4 pages, found ${leads}`);
  assert.ok(graphics >= 1, 'the double-pane glass guide graphic was not found');
});

// ── 2026-10-11 batch: the sliding glass door photo and the gallery additions ──────────────────
// docs/GALLERY-PHOTOS-2026-10-11.md. The door shows on the home "Sliding glass doors" tile and as the
// /sliding-glass-doors hero background. It is deliberately NOT a workPhoto, so it never lands in a
// "Finished result" group, the "Real installs" grid or the page's OG image until Mark confirms the job.
// The data modules import .jpg files, which plain Node cannot load, so read them as text.
const additionsSource = readFileSync(join(root, 'src/data/gallery-additions.ts'), 'utf8');
const workSource = readFileSync(join(root, 'src/data/work.ts'), 'utf8');
const importPaths = new Map([...additionsSource.matchAll(/^import (\w+) from '(\.\.\/assets\/work\/[^']+)';$/gm)].map((m) => [m[1], m[2]]));
const entryPattern = /\{ image: (\w+), alt: '((?:[^'\\]|\\.)*)', caption: '((?:[^'\\]|\\.)*)'/g;
const patioBlock = /export const patioSliderPhoto = \{([\s\S]*?)\n\};/.exec(additionsSource)?.[1] ?? '';
const patioSliderPhoto = {
  image: /image: (\w+)/.exec(patioBlock)?.[1],
  alt: /alt: '((?:[^'\\]|\\.)*)'/.exec(patioBlock)?.[1] ?? '',
  caption: /caption: '((?:[^'\\]|\\.)*)'/.exec(patioBlock)?.[1] ?? '',
};
const additionsBlock = /export const galleryAdditions = \[([\s\S]*?)\n\];/.exec(additionsSource)?.[1] ?? '';
const galleryAdditions = [...additionsBlock.matchAll(entryPattern)].map((m) => ({ image: m[1], alt: m[2], caption: m[3], at: m.index }));
// `patioSliderPhoto,` sits in the array by reference; put it back where it is authored.
const patioAt = /^\s*patioSliderPhoto,/m.exec(additionsBlock)?.index;
assert.notEqual(patioAt, undefined, 'galleryAdditions must include patioSliderPhoto');
galleryAdditions.splice(galleryAdditions.filter((entry) => entry.at < patioAt).length, 0, { ...patioSliderPhoto, at: patioAt });
const PATIO = 'tan-siding-patio-slider';
const sharp = (await import('sharp')).default;
const originals = new Map();
for (const [name, path] of importPaths) originals.set(name, await sharp(join(root, 'src/data', path)).metadata());

ok('the home sliding-glass-doors tile and the doors-page hero use the patio slider photo', () => {
  const tile = /<a class="service-tile" href="\/sliding-glass-doors"[^>]*>[\s\S]*?<\/a>/.exec(pages.get('index'))?.[0] ?? '';
  const [tileImg] = images(tile);
  assert.ok(tileImg, 'the home "Sliding glass doors" tile was not found');
  assert.ok((attr(tileImg, 'src') ?? '').includes(PATIO), 'the home sliding-glass-doors tile must show the patio slider photo');
  assert.ok(widestCandidate(tileImg) >= 1600, 'the home tile tops out below 1600 px (a 3:4 tile at 3x needs it)');
  const doors = pages.get('sliding-glass-doors');
  const hero = /<section class="page-hero page-hero-photo"[^>]*style="([^"]*)"/.exec(doors)?.[1] ?? '';
  assert.ok(hero.includes(PATIO), 'the /sliding-glass-doors hero background must be the patio slider photo');
  // It is a hero wash background only: not an <img> in the page body, and not the OG image.
  assert.ok(!images(doors).some((tag) => (attr(tag, 'src') ?? '').includes(PATIO)), 'the patio photo should be the hero background, not a body <img>');
  assert.ok(!/property="og:image"[^>]*tan-siding-patio-slider/.test(doors) && !/tan-siding-patio-slider[^>]*property="og:image"/.test(doors), 'the doors-page OG image must stay a confirmed job photo');
});

ok('the patio slider photo is not a workPhoto (provenance not confirmed)', () => {
  assert.ok(!workSource.includes(PATIO) && !/gallery-additions/.test(workSource), 'the patio photo must not be in work.ts: workPhotos feeds "Real installs" and the "our job" claims');
  assert.equal(importPaths.get(patioSliderPhoto.image), `../assets/work/${PATIO}.jpg`, 'patioSliderPhoto should import the patio slider file');
  assert.ok(patioSliderPhoto.alt && patioSliderPhoto.caption);
});

ok('gallery additions: every photo has a visual alt and caption, none claims a job', () => {
  const claims = /\b(install(?:ed|ation|s)?|finish(?:ed)?|complete(?:d)?|replac(?:ed|ement)|new[- ]construction|our (?:work|job|crew)|before|after)\b/i;
  const seen = new Set();
  for (const entry of galleryAdditions) {
    assert.ok(entry.alt.trim().length >= 25, `alt too short: "${entry.alt}"`);
    assert.ok(entry.caption.trim().length >= 8, `caption too short: "${entry.caption}"`);
    assert.ok(!seen.has(entry.image), `${entry.caption}: a photo is listed twice`);
    seen.add(entry.image);
    assert.ok(!claims.test(entry.alt) && !claims.test(entry.caption), `"${entry.caption}": describes the picture only. No install/finish/job claims until the source is confirmed.`);
    const meta = originals.get(entry.image);
    assert.ok(meta, `${entry.caption}: image "${entry.image}" is not imported from src/assets/work`);
    assert.ok(meta.width === 3072 && meta.height === 4096, `${entry.caption}: expected a 3072x4096 original, got ${meta.width}x${meta.height}`);
  }
  // Privacy: a customer's house photo must not carry GPS or device metadata (the "View full photo" link ships the original).
  for (const [name, meta] of originals) assert.ok(!meta.exif && !meta.xmp && !meta.iptc, `${name}: embedded EXIF/XMP/IPTC found. Strip it before committing a customer photo.`);
  assert.equal(galleryAdditions.length, 22, '12 first-batch + 10 from 2026-10-11');
});

ok('the gallery renders every addition once, with the 2026-10-11 photos last', () => {
  const html = pages.get('gallery');
  const cards = [...html.matchAll(/<figure class="gallery-addition[^"]*"[^>]*>[\s\S]*?<\/figure>/g)].map((m) => m[0]);
  assert.equal(cards.length, galleryAdditions.length, 'gallery additions rendered != gallery additions declared');
  for (const card of cards) {
    const [tag] = images(card);
    assert.ok(tag && attr(tag, 'srcset') && attr(tag, 'sizes') && (attr(tag, 'alt') ?? '').length > 0, 'a gallery addition without srcset, sizes and alt text');
  }
  assert.ok(cards.slice(12).some((card) => card.includes(PATIO)), 'the patio slider should be in the 2026-10-11 gallery additions');
  for (const [page, markup] of pages) assert.ok(!/IMG_20\d{6}/.test(markup), `${page}: a camera filename leaked into the markup`);
});

console.log(`PASS  image delivery (${groups} groups, ${pages.size} pages)`);
