/**
 * How a stored install method is shown in the Command Center. Mark calls a full-frame install a "fin" install, or
 * just "fin" (2026-10-16). Quotes and Build Plans saved earlier stored "full-frame", so it is still read, and shown
 * as fin; new ones store "fin". Other values (insert, new-construction, verify) show as stored.
 */
export function installMethodLabel(value: unknown): string {
  const method = String(value ?? '').trim();
  return method === 'full-frame' ? 'fin' : method;
}
