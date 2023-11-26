import { ActorSystem, AnyActorRef, AnyActorSystem, EventObject } from '.';

interface ScheduledEvent {
  id: string;
  event: EventObject;
  startedAt: number; // timestamp
  delay: number;
  target: AnyActorRef;
}

export interface Clock {
  setTimeout(fn: (...args: any[]) => void, timeout: number): any;
  clearTimeout(id: any): void;
}

export interface Scheduler {
  events: { [id: string]: ScheduledEvent };
  schedule(data: {
    id: string;
    event: EventObject;
    delay: number;
    source: AnyActorRef;
    target: AnyActorRef;
  }): void;
  cancel(id: string): void;
}

export function createScheduler(
  clock: Clock = {
    setTimeout: (fn, ms) => {
      return setTimeout(fn, ms);
    },
    clearTimeout: (id) => {
      return clearTimeout(id);
    }
  },
  system: AnyActorSystem
): Scheduler {
  const scheduledEvents: { [id: string]: ScheduledEvent } = {};
  const timerMap: { [id: string]: number } = {};

  return {
    events: scheduledEvents,
    schedule: (data: {
      id: string;
      event: EventObject;
      delay: number;
      source: AnyActorRef;
      target: AnyActorRef;
    }) => {
      const scheduledEvent: ScheduledEvent = {
        ...data,
        startedAt: Date.now()
      };
      scheduledEvents[data.id] = scheduledEvent;

      const timeout = clock.setTimeout(() => {
        system._relay(data.source, data.target, data.event);
        delete scheduledEvents[data.id];
      }, data.delay);

      timerMap[data.id] = timeout;
    },
    cancel: (id: string) => {
      const timeout = timerMap[id];
      if (timeout !== undefined) {
        clock.clearTimeout(timeout);
      }
      delete timerMap[id];
      delete scheduledEvents[id];
    }
  };
}
