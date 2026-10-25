// One way for a Command Center page to ask the server for JSON and fail in words a person can act on.
//
// Pages used to copy their own fetch handling, and each told a different story when it went wrong: an expired
// sign-in looked like "could not load", a dropped connection like "Unexpected token <". This sorts the failures into
// four kinds so the page can say the right thing (and `loadFailedNode` in load-failed.ts can offer Try again):
//   session  the sign-in expired (the server answered with the login page or a 401)
//   network  no signal, or the request never reached the server
//   server   the server answered with an error (its own sentence is used when it sent one)
//   response the server answered 200 but not with JSON we can read
import { NO_SIGNAL_MESSAGE } from './load-failed.ts';

export type FetchFailureKind = 'session' | 'network' | 'server' | 'response';

export const SESSION_EXPIRED_MESSAGE = 'Your sign-in expired. Sign in again, then reload this page.';

export class InternalFetchError extends Error {
  kind: FetchFailureKind;
  status: number;
  constructor(kind: FetchFailureKind, message: string, status = 0) {
    super(message);
    this.name = 'InternalFetchError';
    this.kind = kind;
    this.status = status;
  }
}

/** True when a failure means the person has to sign in again, so a page can show that instead of a generic "could not load". */
export const isSessionExpired = (error: unknown): boolean => error instanceof InternalFetchError && error.kind === 'session';

/** Fetches JSON from the same site. Resolves with the parsed body; rejects with an InternalFetchError. */
export async function fetchJson<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: 'same-origin', ...init });
  } catch {
    throw new InternalFetchError('network', NO_SIGNAL_MESSAGE);
  }
  // Behind the login, an expired session is answered with the login page (HTML, often after a redirect) or a 401.
  const type = response.headers.get('content-type') || '';
  if (response.status === 401 || (!type.includes('json') && (response.redirected || type.includes('html')))) {
    throw new InternalFetchError('session', SESSION_EXPIRED_MESSAGE, response.status);
  }
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new InternalFetchError(response.ok ? 'response' : 'server', response.ok ? 'The server sent something this page could not read. Try again.' : 'The server had a problem. Try again in a moment.', response.status);
  }
  if (!response.ok) {
    const sentence = typeof data?.error === 'string' && data.error.trim() ? data.error.trim() : 'That did not work. Try again.';
    throw new InternalFetchError('server', sentence, response.status);
  }
  return data as T;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text made safe to put inside HTML, including inside a quoted attribute. The one escape for pages to share. */
export const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);
