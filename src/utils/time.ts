/**
 * How a solve time is written on screen.
 *
 * Sub-ten-second solves keep a decimal, because at that end of the scale the
 * difference between 1.4s and 1.9s is the whole story and "1s" throws it away — and
 * the sub-second award would otherwise display as "0s", which reads as a bug rather
 * than as the fastest thing the player has ever done. Past ten seconds nobody is
 * counting tenths, so it becomes m:ss.
 */
export function formatDuration(seconds: number): string {
  const value = Math.max(0, seconds);
  if (value < 10) {
    return `${value.toFixed(1)}s`;
  }
  if (value < 60) {
    return `${Math.round(value)}s`;
  }
  const minutes = Math.floor(value / 60);
  const rest = Math.round(value % 60);
  // 1:60 is not a time. A rounded-up remainder rolls into the minute.
  return rest === 60
    ? `${minutes + 1}:00`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}
