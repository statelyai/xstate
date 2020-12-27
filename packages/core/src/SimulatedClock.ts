import { Behavior, stopSignal } from './behavior';
import { Clock } from './interpreter';
import {
  ClockMessage,
  CLOCK_CLEAR_TIMEOUT,
  CLOCK_INCREMENT,
  CLOCK_SET,
  CLOCK_SET_TIMEOUT,
  createClockBehavior
} from './services/clock';
import { ActorRef } from './types';

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
  public now() {
    return this._now;
  }
  private getId() {
    return this._id++;
  }
  public setTimeout(fn: (...args: any[]) => void, timeout: number) {
    const id = this.getId();
    this.timeouts.set(id, {
      start: this.now(),
      timeout,
      fn
    });
    return id;
  }
  public clearTimeout(id: number) {
    this.timeouts.delete(id);
  }
  public set(time: number) {
    if (this._now > time) {
      throw new Error('Unable to travel back in time');
    }

    this._now = time;
    this.flushTimeouts();
  }
  private flushTimeouts() {
    [...this.timeouts]
      .sort(([_idA, timeoutA], [_idB, timeoutB]) => {
        const endA = timeoutA.start + timeoutA.timeout;
        const endB = timeoutB.start + timeoutB.timeout;
        return endB > endA ? -1 : 1;
      })
      .forEach(([id, timeout]) => {
        if (this.now() - timeout.start >= timeout.timeout) {
          this.timeouts.delete(id);
          timeout.fn.call(null);
        }
      });
  }
  public increment(ms: number): void {
    this._now += ms;
    this.flushTimeouts();
  }
}

export function createSimulatedClock(
  parent: ActorRef<any>
): Behavior<ClockMessage, undefined> {
  const simulatedClock = new SimulatedClock();
  // return createClockBehavior(parent, simulatedClock);
  const map: Map<string, any> = new Map();

  const b: Behavior<ClockMessage, undefined> = {
    receive: (_, event) => {
      switch (event.type) {
        case CLOCK_SET_TIMEOUT:
          const timeoutId = simulatedClock.setTimeout(() => {
            parent.send({ type: 'clock.timeoutDone', id: event.id });
          }, event.timeout);
          map.set(event.id, timeoutId);
          parent.send({ type: 'clock.timeoutStarted', id: event.id });
          break;

        case CLOCK_CLEAR_TIMEOUT:
          simulatedClock.clearTimeout(map.get(event.id));
          break;
        case CLOCK_INCREMENT:
          simulatedClock.increment(event.ms);
          break;
        case CLOCK_SET:
          simulatedClock.set(event.ms);
          break;
        default:
          break;
      }

      return b;
    },
    receiveSignal: (_, signal) => {
      if (signal === stopSignal) {
        for (const i of map.values()) {
          simulatedClock.clearTimeout(i);
        }
      }

      return b;
    },
    initial: undefined
  };

  return b;
}
