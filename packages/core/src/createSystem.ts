import { Actor, createActor } from './createActor.ts';
import {
  ActorIdGenerator,
  ActorSystem,
  Clock,
  createActorSystem,
  ScheduledEventIdGenerator,
  SessionIdGenerator
} from './system.ts';
import { ActorOptions, ActorSystemInfo, AnyActorLogic } from './types.ts';

const defaultClock: Clock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id)
};

export interface System<T extends ActorSystemInfo> extends ActorSystem<T> {
  createActor: <TLogic extends AnyActorLogic>(
    logic: TLogic,
    options?: ActorOptions<TLogic>
  ) => Actor<TLogic>;
}

export function createSystem<
  T extends ActorSystemInfo = ActorSystemInfo
>(options?: {
  clock?: Clock;
  logger?: (...args: any[]) => void;
  sessionIdGenerator?: SessionIdGenerator;
  actorIdGenerator?: ActorIdGenerator;
  scheduledEventIdGenerator?: ScheduledEventIdGenerator;
  snapshot?: unknown;
}): System<T> {
  const system = createActorSystem<T>(undefined, {
    clock: options?.clock ?? defaultClock,
    logger: options?.logger ?? console.log.bind(console),
    sessionIdGenerator: options?.sessionIdGenerator,
    actorIdGenerator: options?.actorIdGenerator,
    scheduledEventIdGenerator: options?.scheduledEventIdGenerator,
    snapshot: options?.snapshot
  }) as System<T>;

  system.createActor = ((logic, actorOptions) => {
    return createActor(logic, {
      ...actorOptions,
      system
    });
  }) as System<T>['createActor'];

  return system;
}
