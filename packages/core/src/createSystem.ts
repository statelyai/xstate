import { Actor, createActor } from './createActor.ts';
import {
  ActorIdGenerator,
  ActorSystem,
  Clock,
  createActorSystem,
  ScheduledEventIdGenerator,
  SessionIdGenerator
} from './system.ts';
import {
  EffectIdGenerator,
  initialTransition,
  transition
} from './transition.ts';
import { createInitEvent } from './eventUtils.ts';
import {
  ActorOptions,
  ActorSystemInfo,
  AnyActorLogic,
  EventFromLogic,
  InputFrom,
  SnapshotFrom,
  ExecutableActionObject
} from './types.ts';

const defaultClock: Clock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id)
};

export interface System<T extends ActorSystemInfo> extends ActorSystem<T> {
  createActor: <TLogic extends AnyActorLogic>(
    logic: TLogic,
    options?: ActorOptions<TLogic>
  ) => Actor<TLogic>;
  transition: <TLogic extends AnyActorLogic>(
    logic: TLogic,
    snapshot: SnapshotFrom<TLogic>,
    event: EventFromLogic<TLogic>
  ) => [nextSnapshot: SnapshotFrom<TLogic>, actions: ExecutableActionObject[]];
  initialTransition: <TLogic extends AnyActorLogic>(
    logic: TLogic,
    ...[input]: undefined extends InputFrom<TLogic>
      ? [input?: InputFrom<TLogic>]
      : [input: InputFrom<TLogic>]
  ) => [SnapshotFrom<TLogic>, ExecutableActionObject[]];
}

export function createSystem<
  T extends ActorSystemInfo = ActorSystemInfo
>(options?: {
  clock?: Clock;
  logger?: (...args: any[]) => void;
  sessionIdGenerator?: SessionIdGenerator;
  actorIdGenerator?: ActorIdGenerator;
  scheduledEventIdGenerator?: ScheduledEventIdGenerator;
  effectIdGenerator?: EffectIdGenerator;
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
  system.transition = ((logic, snapshot, event) =>
    transition(logic, snapshot, event, {
      effectIdGenerator: options?.effectIdGenerator
    })) as System<T>['transition'];
  system.initialTransition = ((logic, ...inputOrNothing) => {
    const [snapshot, actions] = initialTransition(
      logic as AnyActorLogic,
      ...(inputOrNothing as [unknown?])
    );
    if (options?.effectIdGenerator) {
      const initEvent = createInitEvent(inputOrNothing[0]) as any;
      actions.forEach((action, index) => {
        action.id = options.effectIdGenerator!({
          event: initEvent,
          index,
          action
        });
      });
    }
    return [snapshot, actions];
  }) as System<T>['initialTransition'];

  return system;
}
