import { listenerLogic } from '../actors/listener.ts';
import { subscriptionLogic } from '../actors/subscription.ts';
import type {
  ActorOptions,
  ActorScope,
  AnyActor,
  AnyActorLogic,
  EnqueueObject,
  EventObject,
  ExecutableActionObject,
  LogicalTimer,
  Snapshot
} from '../types.ts';

type ChildUpdate =
  | { type: 'add'; actor: AnyActor; id: string; prefix?: string; next?: number }
  | { type: 'remove'; actor: AnyActor };

export type FSMEffect = ExecutableActionObject & {
  childUpdate?: ChildUpdate;
};

type Allocation = {
  ids: Set<string>;
  counters: Record<string, number>;
};

const allocations = new WeakMap<object, Allocation>();

export function beginFSMEffects(
  scope: ActorScope<any, any, any, any>,
  snapshot: {
    children: Record<string, AnyActor>;
    _nextActorIds?: Record<string, number>;
  }
) {
  allocations.set(scope, {
    ids: new Set(Object.keys(snapshot.children)),
    counters: { ...snapshot._nextActorIds }
  });
}

function execute(
  this: any,
  runtime = this.source?.system ?? this.actor?.system
) {
  switch (this.type) {
    case '@xstate.spawn':
      return runtime.spawnActor(this.source, this.actor);
    case '@xstate.start':
      return runtime.startActor(this.actor);
    case '@xstate.stop':
      return runtime.stopActor(this.actor);
    case '@xstate.terminate':
      return runtime.terminateActor(this.actor, this);
    case '@xstate.raise':
      return runtime.scheduleTimer(this.source, this.id, this.delay ?? 0);
    case '@xstate.sendTo':
      return this.delay === undefined
        ? runtime.sendEvent(this.source, this.target, this.event)
        : runtime.scheduleTimer(this.source, this.id, this.delay);
    case '@xstate.cancel':
      return runtime.cancelTimer(this.source, this.id);
    case '@xstate.emit':
      return runtime.emitEvent(this.source, this.event);
    default:
      return this.action?.(...this.args);
  }
}

function effect(type: string, fields: object = {}): FSMEffect {
  return {
    kind: 'builtin',
    type,
    params: undefined,
    args: [],
    exec: execute,
    ...fields
  } as unknown as FSMEffect;
}

export function createFSMEnqueue<TEvent extends EventObject>(
  scope: ActorScope<any, any, any, any>,
  effects: FSMEffect[],
  internalEvents: EventObject[]
): EnqueueObject<TEvent, EventObject> {
  const enqueue = ((action: (...args: any[]) => any, ...args: any[]) => {
    effects.push(
      effect(action.name || '(anonymous)', {
        kind: 'action',
        action,
        args
      })
    );
  }) as EnqueueObject<TEvent, EventObject>;

  enqueue.cancel = (id) => {
    effects.push(effect('@xstate.cancel', { source: scope.self, id }));
  };
  enqueue.emit = (event) => {
    effects.push(
      effect('@xstate.emit', {
        kind: 'emit',
        type: '@xstate.emit',
        source: scope.self,
        event
      })
    );
  };
  enqueue.log = (...args) => {
    enqueue(scope.logger, ...args);
  };
  enqueue.raise = (event, options) => {
    if (typeof event === 'string') {
      throw new Error('Only event objects may be used with raise');
    }
    if (options?.delay === undefined) {
      internalEvents.push(event);
    } else {
      effects.push(
        effect('@xstate.raise', {
          source: scope.self,
          event,
          id: options.id,
          delay: options.delay
        })
      );
    }
  };
  enqueue.sendTo = (target, event, options) => {
    if (!target) {
      internalEvents.push({
        type: 'xstate.error.communication',
        error: { message: 'Unable to send event to an undefined actor', event }
      } as EventObject);
      return;
    }
    effects.push(
      effect('@xstate.sendTo', {
        source: scope.self,
        target,
        event,
        id: options?.id,
        delay: options?.delay
      })
    );
  };

  const spawn = (
    logic: string | AnyActorLogic,
    options: ActorOptions<any> = {}
  ) => {
    if (typeof logic === 'string') {
      throw new Error(`Actor source "${logic}" not found`);
    }
    const allocation = allocations.get(scope)!;
    let id = options.id;
    let prefix: string | undefined;
    let next: number | undefined;
    if (id === undefined) {
      prefix = (logic as { id?: string }).id ?? 'x';
      if (prefix === '(machine)') {
        prefix = 'x';
      }
      next = allocation.counters[prefix] ?? 0;
      do {
        id = `${prefix}:${next++}`;
      } while (allocation.ids.has(id));
      allocation.counters[prefix] = next;
    }
    if (allocation.ids.has(id)) {
      throw new Error(`Actor with id "${id}" already exists`);
    }
    allocation.ids.add(id);
    const actor = scope.system.createActorRef(logic, {
      ...options,
      id,
      parent: scope.self
    });
    effects.push(
      effect('@xstate.spawn', {
        source: scope.self,
        actor,
        id,
        logic,
        src: logic,
        input: options.input,
        childUpdate: { type: 'add', actor, id, prefix, next }
      })
    );
    return actor;
  };
  enqueue.spawn = spawn as EnqueueObject<TEvent, EventObject>['spawn'];
  enqueue.stop = (actor) => {
    if (actor) {
      allocations.get(scope)?.ids.delete((actor as AnyActor).id);
      effects.push(
        effect('@xstate.stop', {
          source: scope.self,
          actor,
          id: (actor as AnyActor).id,
          childUpdate: { type: 'remove', actor: actor as AnyActor }
        })
      );
    }
  };

  const attach = (logic: AnyActorLogic, input: unknown) => {
    const actor = scope.system.createActorRef(logic, {
      input,
      parent: scope.self
    });
    effects.push(
      effect('@xstate.spawn', {
        source: scope.self,
        actor,
        id: actor.id,
        logic,
        src: logic,
        input
      })
    );
    return actor;
  };
  enqueue.listen = (actor: any, eventType: string, mapper: any) =>
    attach(listenerLogic, { actor, eventType, mapper });
  enqueue.subscribeTo = (actor: any, mappers: any) =>
    attach(subscriptionLogic, {
      actor,
      mappers: typeof mappers === 'function' ? { snapshot: mappers } : mappers
    });

  return enqueue;
}

export function resolveFSMEffects<
  TSnapshot extends Snapshot<unknown> & {
    children: Record<string, AnyActor>;
    timers: Record<string, LogicalTimer>;
    _nextTimerId: number;
    _nextActorIds?: Record<string, number>;
  }
>(
  snapshot: TSnapshot,
  effects: FSMEffect[],
  scope: ActorScope<any, any, any, any>
): [TSnapshot, ExecutableActionObject[]] {
  let nextSnapshot = snapshot;
  for (const current of effects) {
    const update = current.childUpdate;
    if (update?.type === 'add') {
      nextSnapshot = {
        ...nextSnapshot,
        children: { ...nextSnapshot.children, [update.id]: update.actor },
        ...(update.prefix && {
          _nextActorIds: {
            ...nextSnapshot._nextActorIds,
            [update.prefix]: Math.max(
              nextSnapshot._nextActorIds?.[update.prefix] ?? 0,
              update.next!
            )
          }
        })
      };
    } else if (update?.type === 'remove') {
      const children = { ...nextSnapshot.children };
      let owned = update.actor._parent === scope.self;
      for (const id of Object.keys(children)) {
        if (children[id] === update.actor) {
          owned = true;
          delete children[id];
        }
      }
      if (!owned) {
        throw new Error(`Cannot stop non-child actor ${update.actor.id}`);
      }
      nextSnapshot = { ...nextSnapshot, children };
    }

    if (current.type === '@xstate.cancel') {
      if (nextSnapshot.timers[(current as any).id]) {
        const timers = { ...nextSnapshot.timers };
        delete timers[(current as any).id];
        nextSnapshot = { ...nextSnapshot, timers };
      }
    } else if (
      (current.type === '@xstate.raise' || current.type === '@xstate.sendTo') &&
      (current as any).delay !== undefined
    ) {
      const timer = current as any;
      const generated = timer.id === undefined;
      const id = timer.id ?? `xstate.timer.auto.${nextSnapshot._nextTimerId}`;
      timer.id = id;
      nextSnapshot = {
        ...nextSnapshot,
        timers: {
          ...nextSnapshot.timers,
          [id]: {
            id,
            delay: timer.delay,
            type: timer.type,
            event: timer.event,
            target:
              timer.type === '@xstate.raise' || timer.target === scope.self
                ? 'self'
                : timer.target
          }
        },
        _nextTimerId: generated
          ? nextSnapshot._nextTimerId + 1
          : nextSnapshot._nextTimerId
      };
    }
  }
  return [nextSnapshot, effects];
}

export function appendFSMStarts(effects: ExecutableActionObject[]) {
  const attached: ExecutableActionObject[] = [];
  const children: ExecutableActionObject[] = [];
  for (const current of effects as FSMEffect[]) {
    if (current.type !== '@xstate.spawn') {
      continue;
    }
    const start = effect('@xstate.start', {
      actor: (current as any).actor,
      id: (current as any).id,
      source: (current as any).source
    });
    ((current as any).logic === listenerLogic ||
    (current as any).logic === subscriptionLogic
      ? attached
      : children
    ).push(start);
  }
  return [...effects, ...attached, ...children];
}

export function createFSMSendEffect(
  scope: ActorScope<any, any, any, any>,
  target: AnyActor,
  event: EventObject
) {
  return effect('@xstate.sendTo', {
    source: scope.self,
    target,
    event
  });
}

export function finalizeFSMEffects<TSnapshot extends Snapshot<unknown>>(
  scope: ActorScope<any, any, any, any>,
  previous: TSnapshot | undefined,
  result: [TSnapshot, ExecutableActionObject[]]
): [TSnapshot, ExecutableActionObject[]] {
  const [snapshot, effects] = result;
  if (
    (snapshot.status === 'done' || snapshot.status === 'error') &&
    previous?.status !== 'done' &&
    previous?.status !== 'error'
  ) {
    effects.push(
      effect('@xstate.terminate', {
        source: scope.self,
        actor: scope.self,
        id: scope.self.id,
        status: snapshot.status,
        output: snapshot.output,
        error: snapshot.error
      })
    );
  }
  return [snapshot, effects];
}
