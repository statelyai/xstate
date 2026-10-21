import { Clock } from './system.ts';
import { IndexedHeap } from './IndexedHeap.ts';

/** @public */
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging
export interface SimulatedClock extends Clock {
  start(speed: number): void;
  increment(ms: number): void;
  set(ms: number): void;
}

interface SimulatedTimeout {
  id: number;
  start: number;
  timeout: number;
  fn: (...args: any[]) => void;
}
export class SimulatedClock implements SimulatedClock {
  private timeouts: Map<number, SimulatedTimeout> = new Map();
  private readonly deadlines = new IndexedHeap<SimulatedTimeout>((a, b) => {
    const aTime = a.start + a.timeout;
    const bTime = b.start + b.timeout;
    return aTime < bTime || (aTime === bTime && a.id < b.id);
  });
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
    const timer = {
      id,
      start: this.now(),
      timeout: Math.max(0, timeout),
      fn
    };
    this.timeouts.set(id, timer);
    this.deadlines.push(timer);
    return id;
  }
  public clearTimeout(id: number) {
    const timer = this.timeouts.get(id);
    if (timer) this.deadlines.remove(timer);
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
        const next = this.deadlines.peek();
        if (!next || next.start + next.timeout > destination) break;
        if (++count > 10_000)
          throw new Error(
            'Clock exceeded 10,000 timer callbacks; check for a zero-delay loop'
          );
        this.deadlines.pop();
        this._now = Math.max(this._now, next.start + next.timeout);
        this.timeouts.delete(next.id);
        next.fn.call(null);
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
