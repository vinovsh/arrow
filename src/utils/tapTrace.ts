/**
 * TEMPORARY — input-latency instrumentation for the tap-delay investigation.
 *
 * Every timestamp is relative to the moment the finger *left the glass*, because
 * that is the instant the player expects the arrow to answer. Delete this file and
 * its call sites (grep `tapTrace`) once the question is settled; nothing else in the
 * app reads it and it compiles away in release, `__DEV__` being a build constant.
 */
export const TAP_TRACE = __DEV__;

let liftedAt = 0;

/** Called from the gesture's own thread hop, with the three times it alone knows. */
export function traceTap(
  downAt: number,
  upAt: number,
  activatedAt: number,
): void {
  if (!TAP_TRACE) {
    return;
  }
  liftedAt = upAt;
  console.log(
    `[tap] press held ${upAt - downAt}ms | finger up -> gesture activated ${
      activatedAt - upAt
    }ms`,
  );
}

/** Every later step, stamped against the finger lifting. */
export function trace(label: string): void {
  if (!TAP_TRACE || liftedAt === 0) {
    return;
  }
  console.log(`[tap]   +${Date.now() - liftedAt}ms  ${label}`);
}
