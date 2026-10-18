// What a Command Center screen shows when its data did not arrive. Phones in the field lose signal, so
// every "Loading…" placeholder needs a way out: a plain sentence and a Try again button, in the place the
// data would have been (not a message at the bottom of the page). Styled by `.load-failed` in InternalLayout.

export const NO_SIGNAL_MESSAGE = 'Could not reach the server. Check your signal, then try again.';

/** True for the browser's own wording for a dropped connection, and for our own no-signal sentences. */
export function isNoSignalText(text: string): boolean {
  const value = text.trim();
  return /^(failed to fetch|load failed|networkerror|network request failed|the network connection was lost)/i.test(value) || /could not reach the server/i.test(value);
}

/** A screen's own "could not load / could not check" sentence: also worth a Reload button. */
export function isLoadFailureText(text: string): boolean {
  return isNoSignalText(text) || /^could not (load|check)\b/i.test(text.trim());
}

/** The text for a failed request: the server's own sentence when it sent one, otherwise the no-signal line. */
export function loadFailureMessage(error: unknown, fallback = NO_SIGNAL_MESSAGE): string {
  const text = error instanceof Error ? error.message.trim() : '';
  // A dropped connection reaches us as the browser's own wording ("Failed to fetch", "Load failed", "NetworkError…").
  if (!text || isNoSignalText(text)) return fallback;
  return text;
}

/** A replacement for a "Loading…" placeholder: the message and, when there is something to retry, a button. */
export function loadFailedNode(message: string, onRetry?: () => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'load-failed';
  box.setAttribute('role', 'alert');
  const text = document.createElement('p');
  text.textContent = message;
  box.append(text);
  if (onRetry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost';
    button.textContent = 'Try again';
    button.addEventListener('click', () => {
      button.disabled = true;
      button.textContent = 'Trying…';
      onRetry();
    });
    box.append(button);
  }
  return box;
}
