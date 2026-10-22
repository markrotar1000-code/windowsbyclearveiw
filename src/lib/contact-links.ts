// Links the Command Center puts next to a customer's phone number and address: Text, and Directions.
// Pure functions; a value that is not usable gives '' and the caller shows no link rather than a dead one.
// (Phone numbers of CUSTOMERS who asked to be contacted only. The licensed supplier permit list never links a
// homeowner's number: see .ai/workflows/supplier-permits/CONTEXT.md.)

/** The 10 digits of a US number, or '' ("(360) 555-0100", "1-360-555-0100", "+1 360 555 0100" all give 3605550100). */
export function tenDigits(raw: unknown): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.length === 10 && /^[2-9]/.test(digits) ? digits : '';
}

/** `sms:+13605550100`, which opens the phone's messages app with the number filled in. */
export function smsUrl(phone: unknown): string {
  const digits = tenDigits(phone);
  return digits ? `sms:+1${digits}` : '';
}

/** A Google Maps directions link for a street address (with the city when there is one). No street address, no link:
 *  directions to the middle of a city are not useful. */
export function directionsUrl(address: unknown, city?: unknown): string {
  const street = String(address ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!street) return '';
  const place = [street, String(city ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;
}
