// Window sizes the way the trade writes them: inches, width first, fractions with a slash ("35 1/2 x 47 3/4"),
// never "35-1/2", "35.5" or "35.38". Plain ESM with no dependencies: Pages Functions import it from here and the
// Command Center pages import the same file, so a size is read and shown identically everywhere.
//
// Everything is whole sixteenths of an inch (an integer). No floating point ever touches a dimension, so a size
// cannot drift, and a number that is not a multiple of 1/16 is rounded and flagged, never silently kept.
//
// What this module does NOT do: guess. It reads numbers that are written or spoken as numbers ("thirty five and a
// half", "35 1/2", "35-1/2", "35.5", "3 foot 6"), only when two of them are joined by x / by / times, and ignores
// anything outside 6 to 144 inches (a "2 by 4" is lumber, not a window).

const SIXTEENTH = 16;
export const MIN_INCHES = 6;
export const MAX_INCHES = 144;

const ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const UNICODE_FRACTIONS = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅛': ' 1/8', '⅜': ' 3/8', '⅝': ' 5/8', '⅞': ' 7/8' };

const onesRe = Object.keys(ONES).join('|');
const tensRe = Object.keys(TENS).join('|');
const under100 = `(?:(?:${tensRe})(?:[\\s-]+(?:one|two|three|four|five|six|seven|eight|nine))?|${onesRe})`;
const wordInt = `(?:(?:a|one)\\s+hundred(?:\\s+(?:and\\s+)?${under100})?|${under100})`;
const whole = `(?:\\d{1,3}\\.\\d{1,4}|\\d{1,3}|${wordInt})`;
const fracNum = 'a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen';
const fracDen = 'halves|half|quarters|quarter|eighths|eighth|sixteenths|sixteenth|thirty[\\s-]?seconds?';
const frac = `(?:\\d{1,2}\\s*/\\s*\\d{1,2}|(?:(?:${fracNum})[\\s-]+)?(?:${fracDen}))`;
const joiner = '(?:\\s*-\\s*|\\s+and\\s+|\\s*&\\s*|\\s+)';
const inchUnit = '(?:\\s*(?:inches|inch|in\\b\\.?|"|”))?';

// One dimension: feet and inches ("3 foot 6", "five feet") or inches with an optional fraction.
const dim = (p) => `(?:(?<${p}fw>${whole})\\s*(?:foot|feet|ft\\b\\.?|'|’)(?:\\s*(?:and\\s+)?(?<${p}fi>${whole})(?:${joiner}(?<${p}ff>${frac}))?${inchUnit})?|(?<${p}w>${whole})(?:${joiner}(?<${p}f>${frac}))?${inchUnit})`;
const separator = '(?:\\s*[x×*]\\s*|\\s+(?:by|times)\\s+)';
const SIZE_RE = new RegExp(`(?<![\\w/.])${dim('a')}${separator}${dim('b')}(?!\\d|\\s*/\\s*\\d)`, 'gi');
const DIM_RE = new RegExp(`^\\s*${dim('a')}\\s*$`, 'i');

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function wordsToInt(text) {
  const words = String(text).toLowerCase().split(/[\s-]+/).filter(Boolean);
  let total = 0;
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (w === 'hundred') total = (total || 1) * 100;
    else if (w in TENS) total += TENS[w];
    else if (w in ONES) total += ONES[w];
    // "a", "one" before hundred, and "and" add nothing on their own.
  }
  return total;
}

/** A whole-number part: "36", "35.5", "thirty five" -> { sixteenths, rounded }. */
function wholeToSixteenths(text) {
  const t = String(text).trim();
  if (/^\d/.test(t)) {
    const exact = parseFloat(t) * SIXTEENTH;
    const sixteenths = Math.round(exact);
    return { sixteenths, rounded: Math.abs(exact - sixteenths) > 1e-6 };
  }
  return { sixteenths: wordsToInt(t) * SIXTEENTH, rounded: false };
}

/** A fraction part: "1/2", "three quarters", "a half", "five sixteenths" -> { sixteenths, rounded }. */
function fracToSixteenths(text) {
  const t = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
  let numerator;
  let denominator;
  const slash = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(t);
  if (slash) {
    numerator = Number(slash[1]);
    denominator = Number(slash[2]);
  } else {
    const m = new RegExp(`^(?:(${fracNum})[\\s-]+)?(${fracDen})$`).exec(t);
    if (!m) return null;
    const n = m[1];
    numerator = !n || n === 'a' || n === 'an' ? 1 : (ONES[n] ?? 1);
    const d = m[2];
    denominator = /^half|^halves/.test(d) ? 2 : /^quarter/.test(d) ? 4 : /^eighth/.test(d) ? 8 : /^sixteenth/.test(d) ? 16 : 32;
  }
  if (!denominator || numerator > denominator) return null;
  const exact = (numerator * SIXTEENTH) / denominator;
  const sixteenths = Math.round(exact);
  return { sixteenths, rounded: Math.abs(exact - sixteenths) > 1e-6 };
}

function dimFromGroups(g, p) {
  let sixteenths = 0;
  let rounded = false;
  const add = (part) => { if (!part) return false; sixteenths += part.sixteenths; rounded = rounded || part.rounded; return true; };
  if (g[`${p}fw`]) {
    const feet = wholeToSixteenths(g[`${p}fw`]);
    sixteenths += feet.sixteenths * 12;
    if (g[`${p}fi`]) {
      add(wholeToSixteenths(g[`${p}fi`]));
      if (g[`${p}ff`]) { if (!add(fracToSixteenths(g[`${p}ff`]))) return null; }
    }
  } else {
    add(wholeToSixteenths(g[`${p}w`]));
    if (g[`${p}f`]) { if (!add(fracToSixteenths(g[`${p}f`]))) return null; }
  }
  return { sixteenths, rounded };
}

const plausible = (sixteenths) => sixteenths >= MIN_INCHES * SIXTEENTH && sixteenths <= MAX_INCHES * SIXTEENTH;
const prepare = (text) => String(text ?? '').replace(/[½¼¾⅛⅜⅝⅞]/g, (c) => UNICODE_FRACTIONS[c]);

/** "35 1/2", "36", "7/8": inches from whole sixteenths, fraction reduced, slash not dash. */
export function formatInches(sixteenths) {
  const n = Math.round(sixteenths);
  const inches = Math.floor(n / SIXTEENTH);
  const rest = n % SIXTEENTH;
  if (!rest) return String(inches);
  const g = gcd(rest, SIXTEENTH);
  const fraction = `${rest / g}/${SIXTEENTH / g}`;
  return inches ? `${inches} ${fraction}` : fraction;
}

/** "35 1/2 x 47 3/4": width then height. */
export const formatSize = (size) => `${formatInches(size.w)} x ${formatInches(size.h)}`;

/** A stable identity for a size, for comparing what was said with what a line claims. */
export const sizeKey = (size) => `${size.w}x${size.h}`;

/**
 * One dimension typed or said on its own ("35 1/2", "35-1/2", "35.5", "thirty five and a half", "3 foot 6") ->
 * { sixteenths, rounded } or null. By default only window-sized values count (6 to 144 inches); a field that holds
 * other measurements (a 4 1/2 inch depth, a sill height) passes its own range in inches.
 */
export function parseInches(text, { min = MIN_INCHES, max = MAX_INCHES } = {}) {
  const m = DIM_RE.exec(prepare(text));
  if (!m || !m.groups) return null;
  const d = dimFromGroups(m.groups, 'a');
  return d && d.sixteenths >= min * SIXTEENTH && d.sixteenths <= max * SIXTEENTH ? d : null;
}

/** Every "width by height" in the text, in order: { w, h, text, index, end, rounded }. */
export function extractSizes(text) {
  const source = prepare(text);
  const found = [];
  for (const m of source.matchAll(SIZE_RE)) {
    if (!m.groups) continue;
    const a = dimFromGroups(m.groups, 'a');
    const b = dimFromGroups(m.groups, 'b');
    if (!a || !b || !plausible(a.sixteenths) || !plausible(b.sixteenths)) continue;
    found.push({ w: a.sixteenths, h: b.sixteenths, text: m[0], index: m.index, end: m.index + m[0].length, rounded: a.rounded || b.rounded });
  }
  return found;
}

/** The text with every size rewritten the standard way. Everything else is untouched. */
export function normalizeSizes(text) {
  const source = prepare(text);
  let out = '';
  let at = 0;
  for (const s of extractSizes(source)) {
    out += source.slice(at, s.index) + formatSize(s);
    at = s.end;
  }
  return out + source.slice(at);
}
