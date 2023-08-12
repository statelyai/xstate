import { EventFrom, createActor, fromCallback } from './index.ts';
import { Clock } from './interpreter.ts';
import { ClockActor } from './scheduler.ts';

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

export function createSimulatedClock() {
  const simclock = new SimulatedClock();
  const clockActorLogic = fromCallback(({ sendBack, receive }) => {
    let timeouts = new Map<string, Map<string, any>>();

    receive((msg: EventFrom<ClockActor>) => {
      switch (msg.type) {
        case 'xstate.clock.setTimeout': {
          const { id, timeout } = msg;
          const sessionTimeoutMap =
            timeouts.get(msg.source.sessionId) || new Map();
          timeouts.set(msg.source.sessionId, sessionTimeoutMap);

          sessionTimeoutMap.set(
            id,
            simclock.setTimeout(() => {
              msg.target.send(msg.event);
              sessionTimeoutMap.delete(id);
            }, timeout)
          );
          break;
        }
        case 'xstate.clock.clearTimeout': {
          const { id } = msg;
          const sessionTimeoutMap = timeouts.get(msg.source.sessionId);

          if (sessionTimeoutMap?.has(id)) {
            simclock.clearTimeout(sessionTimeoutMap.get(id));
          }
          break;
        }
        case 'xstate.clock.clearAllTimeouts': {
          const sessionTimeoutMap = timeouts.get(msg.source.sessionId);

          if (sessionTimeoutMap) {
            sessionTimeoutMap.forEach((timeout) =>
              simclock.clearTimeout(timeout)
            );
            sessionTimeoutMap.clear();
          }

          break;
        }
      }
    });

    return () => {
      timeouts.forEach((timeoutMap) => {
        timeoutMap.forEach((timeout) => simclock.clearTimeout(timeout));
      });
      timeouts.clear();
    };
  });

  const clockActor = createActor(clockActorLogic, { clock: {} as any }).start();

  clockActor.increment = simclock.increment.bind(simclock);
  clockActor.set = simclock.set.bind(simclock);

  return clockActor;
}
