// What to show a visitor when a request from one of our public forms fails.
//
// Two kinds of failure reach a catch block:
//   - our own server answered with an error. The form throws `new Error(text)` with text we wrote for
//     visitors ("Fix the highlighted fields.", "Too many requests... call us instead.");
//   - the request never completed (signal dropped, airplane mode, a tunnel). The browser throws a
//     `TypeError` whose text is its own: "Failed to fetch" (Chrome), "Load failed" (Safari),
//     "NetworkError when attempting to fetch resource." (Firefox). That is not for a customer, and on a
//     phone with a weak signal it is the failure customers actually hit.
//
// The Ask page and its callback form already followed this rule; the main estimate form and the
// quote-signing page did not and showed "Failed to fetch". Use this everywhere a visitor sees an error.

/**
 * The answer a failed Ask request still carries, or null. When the model behind /ask/api/chat fails, the
 * server answers 503 with `answer`: the "call or text us at ..., or request an estimate" text written for this
 * moment, the same text the page shows when the assistant is switched off (a 200). A page that throws on every
 * non-OK response shows "Something went wrong." instead and the visitor never sees the phone number.
 */
export function fallbackAnswer(result: unknown): string | null {
  const answer = (result as { answer?: unknown } | null)?.answer;
  return typeof answer === 'string' && answer.trim() ? answer : null;
}

/** The message to show: our server's own text, otherwise `fallback`. */
export function visitorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && !(error instanceof TypeError) && error.message.trim()) return error.message;
  return fallback;
}
