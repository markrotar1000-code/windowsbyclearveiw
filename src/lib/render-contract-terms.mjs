// Populate existing, styled elements with the recorded terms. Never insert HTML
// or substitute today's agreement when an archived version is unavailable.
export function renderContractTerms(root, terms, customPaymentTerms = '') {
  if (!root || !terms) return false;
  const values = { ...terms, paymentTerms: customPaymentTerms || terms.paymentTerms, cancelHeading: terms.rightToCancel.heading };
  terms.rightToCancel.body.forEach((text, index) => { values[`cancel${index}`] = text; });
  root.querySelectorAll('[data-term]').forEach(element => {
    element.textContent = values[element.dataset.term] || '';
  });
  return true;
}
