/**
 * §13 — one `requestAnimationFrame` loop for every arrow in flight, not one each.
 *
 * An escaping arrow has to be redrawn from recomputed geometry every frame, and the
 * obvious way to do that is for each one to run its own rAF loop. That is fine for a
 * single arrow and quietly expensive for four: four loops scheduled independently,
 * and — because each one calls its own `setState` from its own callback — four
 * separate React render passes per frame rather than one. Measured on device during a
 * fast clear-out, that contention pushed a tap's response from about 110ms to about
 * 270ms, with roughly 125ms of it spent before the tap handler was even reached: the
 * gesture's hop to the JS thread was queued behind the animation work.
 *
 * Here every arrow subscribes to a single loop instead. The loop runs only while
 * something is subscribed, and because all the callbacks fire inside one frame
 * callback, React's automatic batching folds their state updates into a single render
 * pass no matter how many arrows are leaving at once.
 *
 * The timestamp is handed out rather than read per subscriber, so every arrow in a
 * frame is advanced to exactly the same instant — with separate `Date.now()` calls
 * they could land a millisecond or two apart and drift from each other over a flight.
 */
type FrameSubscriber = (now: number) => void;

const subscribers = new Set<FrameSubscriber>();
let frame = 0;

function tick(): void {
  const now = Date.now();
  // Iterated over a copy: a subscriber whose flight ends inside its own callback
  // unsubscribes there, and mutating the set mid-iteration would skip its neighbour.
  for (const run of [...subscribers]) {
    run(now);
  }
  frame = subscribers.size > 0 ? requestAnimationFrame(tick) : 0;
}

/**
 * Drives `run` once per frame until the returned function is called. The loop starts
 * on the first subscriber and stops on the last, so an idle board schedules nothing.
 */
export function subscribeToFrames(run: FrameSubscriber): () => void {
  subscribers.add(run);
  if (frame === 0) {
    frame = requestAnimationFrame(tick);
  }
  return () => {
    subscribers.delete(run);
    if (subscribers.size === 0 && frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

/** Test seam: the number of arrows currently being driven. */
export function frameSubscriberCount(): number {
  return subscribers.size;
}
