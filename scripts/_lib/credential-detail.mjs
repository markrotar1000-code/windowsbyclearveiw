// BondTag and InsuranceTag give screen readers the real bond / policy detail as visually-hidden text
// ("WA L&I contractor surety bond #... - $30,000, ..."; "General liability insured - ..., $300,000 per
// occurrence ..."). Those dollar amounts are coverage limits the visitor can already read on hover, not
// prices, so the no-public-pricing checks set exactly these two sentences aside before looking for
// dollar figures. Anything else that is visually hidden is still scanned.
const DETAIL = /<span class="visually-hidden"[^>]*>(?:WA L&amp;I contractor surety bond #|General liability insured — )[^<]*<\/span>/g;

export const withoutCredentialDetail = (html) => html.replace(DETAIL, ' ');
