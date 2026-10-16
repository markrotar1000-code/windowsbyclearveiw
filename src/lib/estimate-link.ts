/** Keep siding inquiries tagged whichever estimate button a visitor chooses. */
export function estimateLink(pathname: string): string {
  return pathname.replace(/\/$/, '') === '/siding'
    ? '/estimate?service=siding&scope=House%20siding'
    : '/estimate';
}

/** Retain routing and valid campaign tags, while removing free-text project details. */
export function retainedEstimateParams(params: URLSearchParams): URLSearchParams {
  const retained = new URLSearchParams();
  if (params.get('service') === 'siding') retained.set('service', 'siding');
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = params.get(key);
    if (value && /^[a-zA-Z][a-zA-Z0-9_.-]{0,99}$/.test(value)) retained.set(key, value);
  }
  return retained;
}
