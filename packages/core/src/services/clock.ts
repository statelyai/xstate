import { Behavior, stopSignal } from '../behavior';
import { ActorRef } from '../types';

export type ClockMessage =
  | { type: 'setTimeout'; id: string; timeout: number }
  | { type: 'clearTimeout'; id: string };

export const createClockBehavior = (
  parent: ActorRef<any>
): Behavior<ClockMessage, undefined> => {
  const map: Map<string, any> = new Map();

  const b = {
    receive: (_, event) => {
      switch (event.type) {
        case 'setTimeout':
          const timeoutId = setTimeout(() => {
            parent.send({ type: 'clock.timeoutDone', id: event.id });
          }, event.timeout);
          map.set(event.id, timeoutId);
          parent.send({ type: 'clock.timeoutStarted', id: event.id });
          break;

        case 'clearTimeout':
          clearTimeout(map.get(event.id));
          break;
        default:
          break;
      }

      return b;
    },
    receiveSignal: (_, signal) => {
      if (signal === stopSignal) {
        for (const i of map.values()) {
          clearTimeout(i);
        }
      }

      return b;
    },
    initial: undefined,
    stop: () => {
      for (const timeoutId of map.values()) {
        clearTimeout(timeoutId);
      }
    }
  };

  return b;
};
