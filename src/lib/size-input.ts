// Typing and showing a measurement in the Command Center the way the trade writes it: inches, fractions with a slash
// ("35 1/2"). Shared by the Measurements tool and Field mode so a size looks and is read the same on every screen.
// Values are stored as plain inches (35.5), exact to 1/16, so saved worksheets, exports and the server keep working.
import { formatInches, parseInches } from '../../functions/_lib/dimensions.mjs';

export const FRACTIONS = ['1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
const ANY_SIZE = { min: 0, max: 999 };

/** What the field shows for a stored number. A value that is not a multiple of 1/16 (an older decimal such as 35.38) is shown as stored, never quietly changed. */
export function showInches(value: number | string | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '';
  const sixteenths = Number(value) * 16;
  if (!Number.isFinite(sixteenths)) return '';
  return Math.abs(sixteenths - Math.round(sixteenths)) < 1e-6 ? formatInches(Math.round(sixteenths)) : String(value);
}

/** The inches a typed size means ("35 1/2", "35-1/2", "35.5"), or null when it is not a size. */
export function readInches(text: string): number | null {
  const parsed = parseInches(text, ANY_SIZE);
  return parsed ? parsed.sixteenths / 16 : null;
}

export const fractionBarHtml = () => `<div class="frac-bar" data-frac-bar role="group" aria-label="Add a fraction to the size you are typing"><span>Sizes are inches, like <strong>35 1/2</strong>. Tap to add a fraction:</span>${FRACTIONS.map((f) => `<button type="button" data-frac="${f}">${f}</button>`).join('')}</div>`;

/**
 * Wires the fraction buttons: a phone keyboard has no "/" within easy reach. A button adds (or replaces) the fraction
 * on the size field used last; mousedown is cancelled so the field keeps focus and the keyboard stays up.
 */
export function bindFractionBar(root: HTMLElement, say: (message: string) => void) {
  let last: HTMLInputElement | null = null;
  root.addEventListener('focusin', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.hasAttribute('data-size')) last = target;
  });
  root.querySelectorAll<HTMLButtonElement>('[data-frac]').forEach((button) => {
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      const input = last;
      if (!input || !input.isConnected) { say('Tap a size field first, then a fraction.'); return; }
      const whole = input.value.trim().replace(/[\s-]*\d{1,2}\s*\/\s*\d{1,2}$/, '').trim();
      if (!whole) { say('Type the whole inches first, then tap a fraction.'); input.focus(); return; }
      input.value = `${whole} ${button.dataset.frac}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  });
}
