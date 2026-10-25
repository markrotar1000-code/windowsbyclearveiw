// The Measurements worksheet -> quote builder handoff. Mark types sizes in Tools > Measurements with a tape in his
// hand; this turns the worksheet into the same draft lines the Rough notes block makes, so a size is typed once and
// reads the same ("35 1/2 x 47 3/4") on the worksheet, the quote line, the Build Plan and Field mode.
//
// Nothing here prices anything: window lines start at the price-book suggestion like every other draft line, and
// anything the price book does not cover (an entry door, "Other") is listed unpriced and flagged for Mark.
import { formatInches } from '../../functions/_lib/dimensions.mjs';
import type { DraftCustomLine, DraftLine, DraftWindowLine } from './quote-notes-lines.ts';

export const MEASUREMENT_KEY = 'clearview:measurement-worksheet:v1';
export const MEASUREMENT_NOTES_HEADER = 'Field measurement notes:';

// Worksheet window type -> price-book opening id. Types with no price-book entry come through as unpriced custom lines.
const TYPE_TO_OPENING: Record<string, string> = {
  'Single-hung': 'single-hung',
  'Double-hung': 'double-hung',
  Slider: 'slider',
  Casement: 'casement',
  Picture: 'picture',
  Awning: 'awning',
  'Bay / bow': 'bay-bow',
  'Patio door': 'sliding-door',
};

export type Worksheet = { jobName: string; jobAddress: string; jobNotes: string; openings: { room: string; type: string; width: number | null; height: number | null; quantity: number; notes: string }[] };

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const inches = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);

/** The saved worksheet, read defensively (it lives in the browser and could be anything), or null when there are no openings. */
export function readWorksheet(raw: string | null): Worksheet | null {
  if (!raw) return null;
  let saved: any;
  try { saved = JSON.parse(raw); } catch { return null; }
  if (!saved || !Array.isArray(saved.openings)) return null;
  const openings = saved.openings.slice(0, 200).map((o: any) => ({
    room: text(o?.room, 100),
    type: text(o?.type, 40) || 'Other',
    width: inches(o?.width),
    height: inches(o?.height),
    quantity: Math.min(99, Math.max(1, Math.floor(Number(o?.quantity)) || 1)),
    notes: text(o?.notes, 300),
  }));
  if (openings.length === 0) return null;
  return { jobName: text(saved.jobName, 160), jobAddress: text(saved.jobAddress, 260), jobNotes: String(saved.jobNotes ?? '').slice(0, 2000).trim(), openings };
}

const sixteenths = (value: number) => ({ n: Math.round(value * 16), exact: Math.abs(value * 16 - Math.round(value * 16)) < 1e-6 });

/** Draft lines for every opening, in worksheet order, plus what Mark should look at. */
export function worksheetToLines(sheet: Worksheet): { lines: DraftLine[]; unpriced: number; checks: string[] } {
  const lines: DraftLine[] = [];
  const checks: string[] = [];
  sheet.openings.forEach((o, index) => {
    const where = o.room || `Opening ${index + 1}`;
    let size = '';
    let sizeRounded = false;
    if (o.width !== null && o.height !== null) {
      const w = sixteenths(o.width);
      const h = sixteenths(o.height);
      size = `${formatInches(w.n)} x ${formatInches(h.n)}`;
      sizeRounded = !w.exact || !h.exact;
      if (sizeRounded) checks.push(`${where}: ${o.width} x ${o.height} is not a multiple of 1/16, shown rounded.`);
      if (o.width < 6 || o.width > 144 || o.height < 6 || o.height > 144) checks.push(`${where}: ${size} is an unusual size. Measure again.`);
    } else if (o.width !== null || o.height !== null) {
      checks.push(`${where}: only the ${o.width !== null ? `width (${formatInches(sixteenths(o.width).n)})` : `height (${formatInches(sixteenths(o.height as number).n)})`} was measured, so no size was added.`);
    } else {
      checks.push(`${where}: no size measured yet.`);
    }
    const note = o.notes;
    const openingId = TYPE_TO_OPENING[o.type];
    if (openingId) {
      const line: DraftWindowLine = { type: 'window', openingId, materialId: null, brandId: null, method: null, quantity: o.quantity, room: o.room, size, sizeRounded, note, heard: '' };
      lines.push(line);
    } else {
      const label = [o.type === 'Other' ? 'Other opening' : o.type, size].filter(Boolean).join(' — ');
      const line: DraftCustomLine = { type: 'custom', label, quantity: o.quantity, room: o.room, size: '', note, heard: '' };
      lines.push(line);
    }
  });
  return { lines, unpriced: lines.filter((l) => l.type === 'custom').length, checks };
}

/** Internal notes (never printed): the job's own notes and each opening's remarks, under one header so a second import adds nothing. */
export function measurementNotes(sheet: Worksheet): string {
  const per = sheet.openings.filter((o) => o.notes).map((o, i) => `- ${o.room || `Opening ${i + 1}`}: ${o.notes}`);
  const body = [sheet.jobName ? `Job: ${sheet.jobName}` : '', sheet.jobNotes, ...per].filter(Boolean).join('\n');
  return body ? `${MEASUREMENT_NOTES_HEADER}\n${body}` : '';
}
