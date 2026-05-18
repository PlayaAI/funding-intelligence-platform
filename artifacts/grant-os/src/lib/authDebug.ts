/** Dev-only auth flow logging for debugging session/profile loading. */
const PREFIX = "[Grant OS Auth]";

export function authDebug(step: string, detail?: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  if (detail) {
    console.log(PREFIX, step, detail);
  } else {
    console.log(PREFIX, step);
  }
}
