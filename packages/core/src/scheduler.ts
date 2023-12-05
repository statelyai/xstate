import { AnyActorRef, EventObject } from '.';
import { AnyActorSystem } from './system';

export interface ScheduledEvent {
  id: string;
  event: EventObject;
  startedAt: number; // timestamp
  delay: number;
  source: AnyActorRef;
  target: AnyActorRef;
}

export interface Clock {
  setTimeout(fn: (...args: any[]) => void, timeout: number): any;
  clearTimeout(id: any): void;
}

export interface Scheduler {
  events: { [id: string]: ScheduledEvent };
  schedule(
    source: AnyActorRef,
    data: {
      id: string | undefined;
      event: EventObject;
      delay: number;
      to?: AnyActorRef;
    }
  ): void;
  cancel(id: string): void;
  cancelAll(actorRef: AnyActorRef): void;
  getPersistedSnapshot(): Record<string, ScheduledEvent>;
  start(): void;
}

const defaultClock: Clock = {
  setTimeout: (fn, ms) => {
    return setTimeout(fn, ms);
  },
  clearTimeout: (id) => {
    return clearTimeout(id);
  }
};

export function createScheduler(
  clock: Clock,
  system: AnyActorSystem,
  snapshot: unknown
): Scheduler {
  const scheduledEvents: { [id: string]: ScheduledEvent } =
    (snapshot as any) ?? {};
  const timerMap: { [id: string]: number } = {};

  const scheduler: Scheduler = {
    events: scheduledEvents,
    schedule: (
      source: AnyActorRef,
      data: {
        id: string | undefined;
        event: EventObject;
        delay: number;
        to: AnyActorRef;
      }
    ) => {
      // TODO: `id` has to be separated from `data.id` completely
      // `data.id` is supposed to be unique within an actor, `id` is supposed to be unique globally
      const id = data.id ?? Math.random().toString(36).slice(2);
      const scheduledEvent: ScheduledEvent = {
        ...data,
        id,
        source,
        target: data.to || source,
        startedAt: Date.now()
      };
      scheduledEvents[id] = scheduledEvent;

      const timeout = clock.setTimeout(() => {
        const target = data.to || source;
        // TODO: explain this hack, it should also happen sooner, not within this timeout
        scheduledEvents[id].target = target;
        delete scheduledEvents[id];
        system._relay(source, target, data.event);
      }, data.delay);

      timerMap[id] = timeout;
    },
    cancel: (id: string) => {
      const timeout = timerMap[id];
      if (timeout !== undefined) {
        clock.clearTimeout(timeout);
      }
      delete timerMap[id];
      delete scheduledEvents[id];
    },
    /**
     * Called when the actorRef is unregistered
     */
    cancelAll: (actorRef) => {
      for (const id in scheduledEvents) {
        if (scheduledEvents[id].source === actorRef) {
          scheduler.cancel(id);
        }
      }
    },
    getPersistedSnapshot: () => {
      return { ...scheduledEvents };
    },
    start: () => {
      for (const id in scheduledEvents) {
        const scheduledEvent = scheduledEvents[id];
        scheduler.schedule(scheduledEvent.source, scheduledEvent);
      }
    }
  };
  return scheduler;
}
