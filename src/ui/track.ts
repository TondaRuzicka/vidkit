// Thin wrapper over Umami custom events.
//
// PRIVACY RULE: never pass file data here — no filename, size, hashes,
// dimensions, duration, or codec of the user's file. Only the user's tool
// choices (output format, mode, engine, error code) may be sent. These describe
// how the tool was used, not the file. Analytics must never break the app, so
// every call is wrapped and failures are swallowed.

type EventData = Record<string, string | number | boolean>;

interface Umami {
  track: (event: string, data?: EventData) => void;
}

declare global {
  interface Window {
    umami?: Umami;
  }
}

export function track(event: string, data?: EventData): void {
  try {
    window.umami?.track(event, data);
  } catch {
    /* analytics is best-effort; never let it affect the compressor */
  }
}
