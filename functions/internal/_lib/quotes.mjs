import { parseWorkType } from './work-types.mjs';

// Kept in sync with src/data/contractTerms.ts by hand, not by import.
// Pages Functions in this repo never import from src/ — functions/api/estimate.js
// sets this precedent, duplicating its FROM address rather than reaching into
// src/data/site.ts — because the Functions bundler's handling of a cross-boundary
// TypeScript import was untested and not worth risking on something this central.
export const TERMS_VERSION = '2026-08-28';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Sanity ceiling on any one line and on a whole quote: $5,000,000. Far above any real job, far below
// the point where cents stop being exact integers (2^53). It exists to catch a typo (an extra run of
// zeros, a pasted number) before it reaches a contract; it is not a pricing rule.
export const MAX_QUOTE_CENTS = 500_000_000;
const MAX_QUOTE_TEXT = '$5,000,000';

export const clean = (v, max = 500) => String(v ?? '').trim().slice(0, max);

/**
 * Shared by create (POST) and edit (PUT): parses+validates the customer and
 * line-item shape a quote is built from, and recomputes totals from the
 * items rather than trusting whatever the client sent — a stray transcription
 * bug in the browser should never become the number printed on a contract.
 * Returns { error } or { name, phone, customer, workType, cleanItems, subtotalCents, discountCents, totalCents, notes }.
 */
export function parseQuoteBody(body) {
  const customer = body.customer || {};
  const name = clean(customer.name, 200);
  const phone = clean(customer.phone, 40);
  if (!name || !phone) {
    return { error: 'Customer name and phone are required.' };
  }

  const type = parseWorkType(body.workType);
  if (type.error) return { error: type.error };

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return { error: 'At least one line item is required.' };
  }

  const cleanItems = [];
  for (const [index, raw] of items.entries()) {
    const label = clean(raw?.label, 300);
    const quantity = Number(raw?.quantity);
    const unitPriceCents = Math.round(Number(raw?.unitPriceCents));
    if (!label || !Number.isFinite(quantity) || quantity <= 0) {
      return { error: `Line ${index + 1}: label and a positive quantity are required.` };
    }
    if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
      return { error: `Line ${index + 1}: unit price is invalid.` };
    }
    const lineTotalCents = Math.round(quantity * unitPriceCents);
    if (!(lineTotalCents <= MAX_QUOTE_CENTS)) {
      return { error: `Line ${index + 1}: that comes to more than ${MAX_QUOTE_TEXT}, which looks like a typo. Check the price and the quantity.` };
    }
    cleanItems.push({
      label,
      description: clean(raw?.description, 500),
      quantity,
      unitPriceCents,
      // Rounded to whole cents: fractional quantities (linear feet of trim) must
      // never put half-cents on a signed contract or invoice.
      lineTotalCents,
    });
  }

  const subtotalCents = cleanItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  if (subtotalCents > MAX_QUOTE_CENTS) {
    return { error: `The quote total comes to more than ${MAX_QUOTE_TEXT}, which looks like a typo. Check the line prices and quantities.` };
  }
  const discountCents = Math.max(0, Math.min(subtotalCents, Math.round(Number(body.discountCents) || 0)));
  const totalCents = subtotalCents - discountCents;

  return {
    name,
    phone,
    workType: type.workType,
    email: clean(customer.email, 200),
    address: clean(customer.address, 300),
    city: clean(customer.city, 120),
    role: clean(customer.role, 40),
    notes: clean(body.notes, 4000),
    discountReason: clean(body.discountReason, 200),
    cleanItems,
    subtotalCents,
    discountCents,
    totalCents,
  };
}
