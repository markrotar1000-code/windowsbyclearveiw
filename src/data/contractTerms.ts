/**
 * Versioned contract terms shared by the customer review and internal quote.
 * Payment at completion and manufacturer-claim responsibility follow owner instructions.
 * These terms have not been approved by legal counsel. The contract review in
 * .ai/references/contract-legal-review-2026-11-03.md documents outstanding statutory
 * disclosure, cancellation-form and signed-copy delivery requirements.
 * Cancellation rules depend on the transaction; online signing alone does not
 * determine whether an in-home solicitation is covered.
 * Preserve every published version verbatim and never substitute current terms
 * for the terms accepted on an existing signed agreement.
 */

import { site } from './site';

export const TERMS_VERSION = '2026-11-03.2';

// New contracts do not include a separate workmanship warranty (owner direction, 2026-11-03).

export const contractTerms = {
  paymentTerms:
    'Payment is due in full upon completion of the work described in this agreement, including ' +
    'approved written change orders. Any payments already received will be credited against ' +
    'the total contract price.',

  changeOrders:
    'Any change to the scope of work described above must be agreed to in writing by both ' +
    'parties and may adjust the total price and completion date.',

  warranty:
    'Windows and materials carry the manufacturer’s own warranty. ' +
    'The customer is responsible for contacting the manufacturer directly and handling any ' +
    'manufacturer warranty claim. ' +
    `${site.legalName} does not handle or assist with manufacturer warranty claims and does ` +
    'not extend or replace the manufacturer’s warranty.',

  delays:
    `${site.legalName} is not responsible for delays caused by material availability, ` +
    'weather, or conditions discovered once work begins (including but not limited to rot or ' +
    'structural damage not visible at the time of this estimate). The customer will be notified ' +
    'promptly if a delay or a change in scope becomes necessary.',

  governingLaw:
    'This agreement is governed by the laws of the State of Washington. Any dispute arising ' +
    'from this agreement will be brought in the state or federal courts serving Clark County, ' +
    'Washington.',

  // Close to the FTC's model "Notice of Cancellation" language, which is the
  // safer choice here rather than a shortened paraphrase.
  rightToCancel: {
    heading: 'Notice of right to cancel',
    body: [
      'You may cancel this transaction, without any penalty or obligation, within THREE ' +
        'BUSINESS DAYS from the date on which you sign this contract.',
      `To cancel, you must notify ${site.legalName} in writing by mail to 9407 NE 105th Ave, Vancouver, WA 98662, or by email to owner@windowsbyclearveiw.com, before ` +
        'midnight of the third business day after the date of this contract. Notice sent by ' +
        'mail is effective when postmarked.',
      'If you cancel, any payment made and any goods traded in will be returned within 10 days ' +
        'of receipt of your cancellation notice, and any security interest arising from the ' +
        'transaction will be cancelled.',
    ],
  },

  acknowledgement:
    'By signing below, both parties agree to the scope of work, price, and terms stated in ' +
    'this document.',
};

// Preserve the exact wording accepted on older agreements. Never use current
// terms as a fallback for an unknown signed terms version.
export const contractTermsByVersion: Record<string, typeof contractTerms> = {
  '2026-08-28': {
  "paymentTerms": "Payment is due as agreed in writing between Clearview Windows & Trim LLC and the customer. No deposit is collected as part of this document; any deposit or payment schedule will be stated separately before work begins.",
  "changeOrders": "Any change to the scope of work described above must be agreed to in writing by both parties and may adjust the total price and completion date.",
  "warranty": "Workmanship is warranted for 1 year from the date work is completed. Windows and materials carry the manufacturer’s own warranty; Clearview Windows & Trim LLC will assist in facilitating a manufacturer warranty claim but does not itself extend or replace it.",
  "delays": "Clearview Windows & Trim LLC is not responsible for delays caused by material availability, weather, or conditions discovered once work begins (including but not limited to rot or structural damage not visible at the time of this estimate). The customer will be notified promptly if a delay or a change in scope becomes necessary.",
  "governingLaw": "This agreement is governed by the laws of the State of Washington. Any dispute arising from this agreement will be brought in the state or federal courts serving Clark County, Washington.",
  "rightToCancel": {
    "heading": "Notice of right to cancel",
    "body": [
      "You may cancel this transaction, without any penalty or obligation, within THREE BUSINESS DAYS from the date on which you sign this contract.",
      "To cancel, you must notify Clearview Windows & Trim LLC in writing, by mail or email, before midnight of the third business day after the date of this contract. Notice sent by mail is effective when postmarked.",
      "If you cancel, any payment made and any goods traded in will be returned within 10 days of receipt of your cancellation notice, and any security interest arising from the transaction will be cancelled."
    ]
  },
  "acknowledgement": "By signing below, both parties agree to the scope of work, price, and terms stated in this document."
},
  '2026-11-03': {
  "paymentTerms": "Payment is due as agreed in writing between Clearview Windows & Trim LLC and the customer. No deposit is collected as part of this document; any deposit or payment schedule will be stated separately before work begins.",
  "changeOrders": "Any change to the scope of work described above must be agreed to in writing by both parties and may adjust the total price and completion date.",
  "warranty": "Windows and materials carry the manufacturer’s own warranty. The customer is responsible for contacting the manufacturer directly and handling any manufacturer warranty claim. Clearview Windows & Trim LLC does not handle or assist with manufacturer warranty claims and does not extend or replace the manufacturer’s warranty.",
  "delays": "Clearview Windows & Trim LLC is not responsible for delays caused by material availability, weather, or conditions discovered once work begins (including but not limited to rot or structural damage not visible at the time of this estimate). The customer will be notified promptly if a delay or a change in scope becomes necessary.",
  "governingLaw": "This agreement is governed by the laws of the State of Washington. Any dispute arising from this agreement will be brought in the state or federal courts serving Clark County, Washington.",
  "rightToCancel": {
    "heading": "Notice of right to cancel",
    "body": [
      "You may cancel this transaction, without any penalty or obligation, within THREE BUSINESS DAYS from the date on which you sign this contract.",
      "To cancel, you must notify Clearview Windows & Trim LLC in writing, by mail or email, before midnight of the third business day after the date of this contract. Notice sent by mail is effective when postmarked.",
      "If you cancel, any payment made and any goods traded in will be returned within 10 days of receipt of your cancellation notice, and any security interest arising from the transaction will be cancelled."
    ]
  },
  "acknowledgement": "By signing below, both parties agree to the scope of work, price, and terms stated in this document."
},
  [TERMS_VERSION]: contractTerms,
};

export function getContractTerms(version: string = TERMS_VERSION) {
  return Object.prototype.hasOwnProperty.call(contractTermsByVersion, version)
    ? contractTermsByVersion[version]
    : undefined;
}
