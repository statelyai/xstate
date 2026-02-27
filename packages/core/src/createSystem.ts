import { Actor, createActor } from './createActor.ts';
import { ActorSystem, Clock, createActorSystem } from './system.ts';
import { ActorOptions, ActorSystemInfo, AnyActorLogic } from './types.ts';

const defaultClock: Clock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id)
};

export interface System<T extends ActorSystemInfo> extends ActorSystem<T> {
  register: <K extends keyof T['actors']>(
    key: K,
    actorRef: T['actors'][K]
  ) => void;
  receptionist: {
    register: <K extends keyof T['actors']>(
      key: K,
      actorRef: T['actors'][K]
    ) => void;
    get: <K extends keyof T['actors']>(key: K) => T['actors'][K] | undefined;
    getAll: () => Partial<T['actors']>;
  };
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
  snapshot?: unknown;
}): System<T> {
  const system = createActorSystem<T>(undefined, {
    clock: options?.clock ?? defaultClock,
    logger: options?.logger ?? console.log.bind(console),
    snapshot: options?.snapshot
  }) as System<T>;

  system.register = ((key, actorRef) => {
    system._set(key as never, actorRef as never);
  }) as System<T>['register'];

  system.receptionist = {
    register: system.register,
    get: system.get,
    getAll: system.getAll
  };

  system.createActor = ((logic, actorOptions) => {
    return createActor(logic, {
      ...actorOptions,
      system
    });
  }) as System<T>['createActor'];

  return system;
}
