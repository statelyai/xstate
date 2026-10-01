import { Clock } from './system.ts';

/** @public */
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging
export interface SimulatedClock extends Clock {
  start(speed: number): void;
  increment(ms: number): void;
  set(ms: number): void;
}

interface SimulatedTimeout {
  start: number;
  timeout: number;
  fn: (...args: any[]) => void;
}
export class SimulatedClock implements SimulatedClock {
  private timeouts: Map<number, SimulatedTimeout> = new Map();
  private _now: number = 0;
  private _id: number = 0;
  private _flushing = false;

  public now() {
    return this._now;
  }
  private getId() {
    return this._id++;
  }
  public setTimeout(fn: (...args: any[]) => void, timeout: number) {
    if (!Number.isFinite(timeout))
      throw new Error('Timer delay must be finite');
    const id = this.getId();
    this.timeouts.set(id, {
      start: this.now(),
      timeout: Math.max(0, timeout),
      fn
    });
    return id;
  }
  public clearTimeout(id: number) {
    this.timeouts.delete(id);
  }
  public set(time: number) {
    if (!Number.isFinite(time) || this._now > time) {
      throw new Error(
        'Clock time must be finite; unable to travel back in time'
      );
    }
    if (this._flushing)
      throw new Error('Cannot advance a clock during a timer callback');
    this.flushTimeouts(time);
  }
  private flushTimeouts(destination: number) {
    this._flushing = true;

    try {
      let count = 0;
      while (true) {
        const next = [...this.timeouts].sort(
          ([aId, a], [bId, b]) =>
            a.start + a.timeout - (b.start + b.timeout) || aId - bId
        )[0];
        if (!next || next[1].start + next[1].timeout > destination) break;
        if (++count > 10_000)
          throw new Error(
            'Clock exceeded 10,000 timer callbacks; check for a zero-delay loop'
          );
        const [id, timeout] = next;
        this._now = Math.max(this._now, timeout.start + timeout.timeout);
        this.timeouts.delete(id);
        timeout.fn.call(null);
      }
      this._now = destination;
    } finally {
      this._flushing = false;
    }
  }
  public increment(ms: number): void {
    this.set(this._now + ms);
  }
}
