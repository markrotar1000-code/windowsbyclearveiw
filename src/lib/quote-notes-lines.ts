// Turns the validated draft from /internal/api/quote-notes into quote builder lines. Shared by the page and its test.
//
// Prices are never the AI's: a window line starts at the same price-book suggestion the Add line button uses
// (src/lib/quote-pricing.ts) and Mark edits it; anything the price book does not cover (trim, rot, a discount,
// every line on a siding quote) starts at $0 and is flagged so it cannot be missed.
// Printed text stays clean: only the room and the product names go on the line. Sizes, extra remarks and what
// Mark said go to the internal notes (never printed on the contract).
import { suggestedUnitPrice } from './quote-pricing.ts';

export type DraftWindowLine = { type: 'window'; openingId: string; materialId: string | null; brandId: string | null; method: 'insert' | 'fin' | null; quantity: number; room: string; size: string; sizeRounded?: boolean; note: string; heard: string };
export type DraftCustomLine = { type: 'custom'; label: string; quantity: number; room: string; size: string; note: string; heard: string };
export type DraftLine = DraftWindowLine | DraftCustomLine;
export type DraftCatalog = {
  openings: { id: string; label: string; low: number; high: number; isDoor: boolean; quotePrice: number | null }[];
  materials: { id: string; label: string; multiplier: number }[];
  brands: { id: string; label: string; low: number; high: number }[];
};
export type DraftItem = { label: string; description: string; quantity: number; unitPrice: number };

export const NOTES_MAX = 4000;

/** One builder line for a draft line, or null when it names an opening the price book does not have. */
export function draftLineToItem(line: DraftLine, catalog: DraftCatalog, workType: 'windows' | 'siding'): DraftItem | null {
  const prefix = line.room ? `${line.room}: ` : '';
  if (line.type === 'custom') {
    return { label: `${prefix}${line.label}`, description: '', quantity: line.quantity, unitPrice: 0 };
  }
  const opening = catalog.openings.find((o) => o.id === line.openingId);
  if (!opening) return null;
  const material = catalog.materials.find((m) => m.id === line.materialId) ?? catalog.materials[0];
  const brand = catalog.brands.find((b) => b.id === line.brandId) ?? null;
  // A siding quote is priced per square foot by Mark: a window the notes mention is listed, not priced.
  if (workType === 'siding') return { label: `${prefix}${opening.label}`, description: '', quantity: line.quantity, unitPrice: 0 };
  // Only say what was said: when the method was not stated, leave it out (the Build Plan then reads it as VERIFY).
  const unitPrice = suggestedUnitPrice({ opening, materialMultiplier: material?.multiplier, brand });
  // The size goes last, width x height in inches, fractions with a slash ("35 1/2 x 47 3/4"), exactly as the page
  // and the server read it from the notes. It is Mark's own measurement, shown on the line so he sees it as he checks it.
  const parts = [opening.label, line.materialId ? material?.label : null, !opening.isDoor ? brand?.label : null, line.method, line.size || null].filter(Boolean);
  return { label: `${prefix}${parts.join(' — ')}`, description: '', quantity: line.quantity, unitPrice };
}

/** True when the line still needs Mark to type a price. */
export const needsPrice = (item: Pick<DraftItem, 'unitPrice'>) => !(item.unitPrice > 0);

export const NOTES_HEADER = 'Walk-through notes (rough, from voice/typing):';

/** The internal-notes block for a draft: what Mark said, plus any size or remark the lines carry. */
export function notesBlock(rawNotes: string, lines: DraftLine[], withHeader = true): string {
  const detail = lines
    .filter((l) => l.size || l.note)
    .map((l) => {
      const what = l.type === 'custom' ? l.label : l.openingId;
      return `- ${[l.room, what].filter(Boolean).join(' ')} x${l.quantity}: ${[l.size ? `size heard ${l.size}${l.sizeRounded ? ' (rounded to the nearest 1/16, recheck)' : ''} (confirm at measure)` : '', l.note].filter(Boolean).join('; ')}`;
    });
  return [...(withHeader ? [NOTES_HEADER] : []), rawNotes.trim(), ...(detail.length ? ['Details heard:', ...detail] : [])].join('\n');
}

/**
 * What to send for drafting. Mark records room by room, so only the words added since the last draft go to the
 * model and earlier lines are never duplicated. If he edited text that was already drafted, the whole box is sent
 * and the page replaces the earlier draft (after asking).
 */
export function nextDraftText(value: string, consumed: string): { text: string; replaceAll: boolean } {
  const now = value.trim();
  const before = consumed.trim();
  if (!before) return { text: now, replaceAll: false };
  if (now.startsWith(before)) return { text: now.slice(before.length).trim(), replaceAll: false };
  return { text: now, replaceAll: true };
}

/** Appends a block to the existing notes without repeating it, and never past the notes limit. */
export function mergeNotes(existing: string, block: string, max = NOTES_MAX): string {
  const current = existing.trim();
  if (current.includes(block.trim())) return current;
  const merged = current ? `${current}\n\n${block}` : block;
  return merged.length <= max ? merged : merged.slice(0, max);
}
