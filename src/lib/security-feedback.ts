// Security-check recovery must not erase a later form/server error or discard
// the visitor's fields. The widget remains responsible for issuing its token.
export function securityFeedback(status: HTMLElement, retry: Element | null, onRetry: () => void) {
  let message = '';
  function ready() {
    if (message && status.textContent === message) status.textContent = '';
    message = '';
    if (retry instanceof HTMLElement) retry.hidden = true;
  }
  retry?.addEventListener('click', () => { ready(); onRetry(); });
  return {
    fail(text: string) {
      message = text;
      status.textContent = text;
      if (retry instanceof HTMLElement) retry.hidden = false;
    },
    ready,
  };
}
