// Paste the function below into GTM variable "JS - Safe Referrer".
// It preserves the existing query/fragment stripping and handles the first
// hard load before the Astro page-load tracker has run.
function() {
  var referrer = typeof window.clearviewPageReferrer === 'string'
    ? window.clearviewPageReferrer : document.referrer;
  if (!referrer) return '';
  var a = document.createElement('a');
  a.href = referrer;
  if (a.protocol !== 'https:' && a.protocol !== 'http:') return '';
  return a.protocol + '//' + a.host + a.pathname;
}
