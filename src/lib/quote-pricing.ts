// The suggested starting price for a price-book line on the quote builder. Shared by the page and its test.
//
// It is only a suggestion: every line stays editable by Mark until the quote is signed.
// The install method (insert, or fin = Mark's internal name for a full-frame install) is a label on the
// line and never changes the price. The base is Mark's own quotePrice for the opening when he has set one
// (src/data/pricing.ts), otherwise the midpoint of the range, then material and window brand.

export type PriceOpening = { low: number; high: number; isDoor: boolean; quotePrice?: number | null };
export type PriceRange = { low: number; high: number };

const mid = (range: PriceRange) => (range.low + range.high) / 2;

export function suggestedUnitPrice(input: {
  opening: PriceOpening;
  materialMultiplier?: number;
  brand?: PriceRange | null;
}): number {
  const { opening, brand } = input;
  let price = (opening.quotePrice || mid(opening)) * (input.materialMultiplier ?? 1);
  if (!opening.isDoor && brand) price += mid(brand);
  return Math.round(price / 10) * 10;
}
