// The suggested starting price for a price-book line on the quote builder. Shared by the page and its test.
//
// It is only a suggestion: every line stays editable by Mark until the quote is signed.
// A fin install uses Mark's own all-in fin price for the opening when he has set one (finPrice in
// src/data/pricing.ts). Without one it falls back to the insert price plus the frame allowance, which is a
// regional guess: the caller should expect Mark to correct that line (VERIFY).

export type PriceOpening = { low: number; high: number; isDoor: boolean; finPrice?: number | null };
export type PriceRange = { low: number; high: number };
export type InstallMethod = 'insert' | 'fin';

const mid = (range: PriceRange) => (range.low + range.high) / 2;

export function suggestedUnitPrice(input: {
  opening: PriceOpening;
  materialMultiplier?: number;
  brand?: PriceRange | null;
  method: InstallMethod;
  finAllowance: PriceRange;
}): { unitPrice: number; ownFinPrice: boolean } {
  const { opening, brand, method, finAllowance } = input;
  const ownFin = method === 'fin' && opening.finPrice ? opening.finPrice : null;
  let price = (ownFin ?? mid(opening)) * (input.materialMultiplier ?? 1);
  if (!opening.isDoor && brand) price += mid(brand);
  if (method === 'fin' && ownFin === null) price += mid(finAllowance);
  return { unitPrice: Math.round(price / 10) * 10, ownFinPrice: ownFin !== null };
}
