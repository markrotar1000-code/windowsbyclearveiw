// A phone number must not break across two lines: "(564)" at the end of one line and "208-0801" at the start of
// the next is hard to read and harder to tap or dial from. Browsers break at any ordinary space, so the space
// inside the number has to be a non-breaking one.
//
// Found 2026-10-11: 19 of 918 phone numbers measured on the public pages (7 widths) wrapped, mostly the area
// pages' one-line summaries, which come from the city files' `description` (also the page's meta description,
// where a plain space is right). Apply this to text that is shown on the page; leave meta tags, structured data
// and `tel:` links alone. `test:text-gaps` fails on a number in prose that still has a plain space.

/** "(564) 208-0801" with a non-breaking space after the area code. Other text is returned unchanged. */
export function keepPhoneTogether(text: string): string {
  return text.replace(/\((\d{3})\) (\d{3}-\d{4})/g, '($1) $2');
}
