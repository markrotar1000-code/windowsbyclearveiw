// Is the microphone actually hearing Mark? A phone in a pocket, a covered mic or the wrong input all record
// minutes of silence that then come back as "I did not hear any words". This is the pure part of the live level
// meter: the loudness of a frame of audio, and a watcher that says so after a few seconds of near-silence.

/** Loudness 0..1 of a frame of unsigned 8-bit samples centred on 128 (an AnalyserNode's time-domain bytes). */
export function rmsOfBytes(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const centred = (samples[i] - 128) / 128;
    sum += centred * centred;
  }
  return Math.sqrt(sum / samples.length);
}

/** The width of the meter bar, 0..1, so ordinary speech fills most of it (speech is quiet in absolute terms). */
export const meterFill = (rms: number) => Math.max(0, Math.min(1, rms * 5));

export type SilenceEvent = 'silent' | 'recovered' | null;

/**
 * Feed it a loudness reading and the time. It answers 'silent' once when the level has stayed below the floor for
 * `afterMs`, 'recovered' once when sound returns, and null otherwise, so the page changes its message only on a change.
 */
export function createSilenceWatch({ floor = 0.012, afterMs = 6000 } = {}) {
  let quietSince: number | null = null;
  let warned = false;
  return {
    feed(rms: number, now: number): SilenceEvent {
      if (rms >= floor) {
        quietSince = null;
        if (warned) { warned = false; return 'recovered'; }
        return null;
      }
      if (quietSince === null) quietSince = now;
      if (!warned && now - quietSince >= afterMs) { warned = true; return 'silent'; }
      return null;
    },
    reset() { quietSince = null; warned = false; },
  };
}
