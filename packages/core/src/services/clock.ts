import { Behavior, stopSignal } from '../behavior';
import { ActorRef } from '../types';

export const CLOCK_SET_TIMEOUT = Symbol('clock.setTimeout');
export const CLOCK_CLEAR_TIMEOUT = Symbol('clock.clearTimeout');
export const CLOCK_INCREMENT = Symbol('clock.increment');
export const CLOCK_SET = Symbol('clock.set');

export type ClockMessage =
  | { type: typeof CLOCK_SET_TIMEOUT; id: string; timeout: number }
  | { type: typeof CLOCK_CLEAR_TIMEOUT; id: string }
  | { type: typeof CLOCK_INCREMENT; ms: number }
  | { type: typeof CLOCK_SET; ms: number };

export interface Clock {
  setTimeout(handler: (...args: any[]) => void, timeout: number): number;
  clearTimeout(handle: number): void;
  increment?(ms: number): void;
  set?(ms: number): void;
}

const defaultClock: Clock = {
  setTimeout: (fn, ms) => {
    return setTimeout(fn, ms);
  },
  clearTimeout: (id) => {
    return clearTimeout(id);
  }
};

export function createClockBehavior<T extends Clock>(
  parent: ActorRef<any>,
  clock: T = defaultClock as T
): Behavior<ClockMessage, undefined> {
  const map: Map<string, any> = new Map();

  const behavior: Behavior<ClockMessage, undefined> = {
    receive: (_, event) => {
      switch (event.type) {
        case CLOCK_SET_TIMEOUT:
          const timeoutId = clock.setTimeout(() => {
            parent.send({ type: 'clock.timeoutDone', id: event.id });
          }, event.timeout);
          map.set(event.id, timeoutId);
          parent.send({ type: 'clock.timeoutStarted', id: event.id });
          break;

        case CLOCK_CLEAR_TIMEOUT:
          clock.clearTimeout(map.get(event.id));
          break;
        case CLOCK_INCREMENT:
          clock.increment?.(event.ms);
        case CLOCK_SET:
          clock.set?.(event.ms);
        default:
          break;
      }

      return behavior;
    },
    receiveSignal: (_, signal) => {
      if (signal === stopSignal) {
        for (const i of map.values()) {
          clock.clearTimeout(i);
        }
      }

      return behavior;
    },
    initial: undefined
  };

  return behavior;
}
