import {
  frameSubscriberCount,
  subscribeToFrames,
} from '../src/game/renderer/frameClock';

/** react-native's typings have no DOM lib, so the callback shape is spelled out. */
type RafCallback = (time: number) => void;

/**
 * The clock is shared by every arrow in flight, so the cases that matter are the ones
 * where the set changes while it is being walked — an arrow's flight ends inside its
 * own callback, which is exactly when it unsubscribes.
 */
describe('frameClock', () => {
  let pending: RafCallback[] = [];
  let nextHandle = 1;

  beforeEach(() => {
    pending = [];
    nextHandle = 1;
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((cb: RafCallback) => {
        pending.push(cb);
        return nextHandle++ as unknown as number;
      });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Runs exactly the frames queued right now, not the ones they go on to queue. */
  const advance = (frames: number): void => {
    for (let i = 0; i < frames; i++) {
      const due = pending;
      pending = [];
      for (const cb of due) {
        cb(0);
      }
    }
  };

  it('drives every subscriber once per frame', () => {
    const a = jest.fn();
    const b = jest.fn();
    const stopA = subscribeToFrames(a);
    const stopB = subscribeToFrames(b);

    advance(3);

    expect(a).toHaveBeenCalledTimes(3);
    expect(b).toHaveBeenCalledTimes(3);
    stopA();
    stopB();
  });

  it('hands every subscriber in a frame the same timestamp', () => {
    const seen: number[] = [];
    const stopA = subscribeToFrames(now => seen.push(now));
    const stopB = subscribeToFrames(now => seen.push(now));

    advance(1);

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
    stopA();
    stopB();
  });

  it('does not skip a neighbour when one unsubscribes mid-frame', () => {
    // The failure this guards: iterating the live Set while the first callback
    // removes itself, which advances the iterator past the second.
    const second = jest.fn();
    let stopFirst = (): void => {};
    stopFirst = subscribeToFrames(() => stopFirst());
    const stopSecond = subscribeToFrames(second);

    advance(1);

    expect(second).toHaveBeenCalledTimes(1);
    expect(frameSubscriberCount()).toBe(1);
    stopSecond();
  });

  it('stops scheduling once the last subscriber leaves, and restarts after', () => {
    const stop = subscribeToFrames(() => {});
    advance(1);
    expect(pending).toHaveLength(1);

    stop();
    advance(1);
    expect(pending).toHaveLength(0);
    expect(frameSubscriberCount()).toBe(0);

    // A later arrow has to get the loop going again rather than find it dead.
    const run = jest.fn();
    const stopAgain = subscribeToFrames(run);
    advance(1);
    expect(run).toHaveBeenCalledTimes(1);
    stopAgain();
  });

  it('survives a subscriber unsubscribing twice', () => {
    const stop = subscribeToFrames(() => {});
    stop();
    expect(() => stop()).not.toThrow();
    expect(frameSubscriberCount()).toBe(0);
  });
});
