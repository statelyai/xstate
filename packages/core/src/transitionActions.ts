import isDevelopment from '#is-development';
import { assertSendToEvent, builtInActions } from './actions.ts';
import { listenerLogic, type ListenerInput } from './actors/listener.ts';
import {
  subscriptionLogic,
  type SubscriptionInput,
  type SubscriptionMappers
} from './actors/subscription.ts';
import { XSTATE_SPAWN, XSTATE_START, XSTATE_TERMINATE } from './constants.ts';
import { createErrorPlatformEvent } from './eventUtils.ts';
import type { ActorSystemRuntime } from './system.ts';
import { getEventOutput } from './utils.ts';
import type {
  Action,
  ActorTermination,
  AnyAction,
  AnyActor,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  CancelExecutableActionObject,
  CustomExecutableActionObject,
  EmitExecutableActionObject,
  EnqueueObject,
  EventObject,
  ExecutableActionObject,
  MachineContext,
  RaiseExecutableActionObject,
  SendToExecutableActionObject,
  Snapshot,
  SpecialExecutableAction,
  SpawnExecutableActionObject,
  StartExecutableActionObject,
  StopExecutableActionObject,
  TerminateExecutableActionObject
} from './types.ts';

type TransitionActionRecord = {
  action: (...args: any[]) => any;
  args: any[];
  childUpdate?:
    | { type: 'add'; actor: AnyActor; id: string }
    | { type: 'remove'; actor: AnyActor };
};

type EffectRuntime = Partial<ActorSystemRuntime>;

function execCustomEffect(
  this: CustomExecutableActionObject
): void | PromiseLike<void> | undefined {
  return this.action?.(...this.args);
}

function execEmitEffect(
  this: EmitExecutableActionObject,
  runtime: EffectRuntime = this.source.system
): void | PromiseLike<void> {
  return runtime.emitEvent!(this.source, this.event);
}

/** @internal Creates an emitted-event effect. */
export function createEmitEffect(
  actorScope: AnyActorScope,
  event: EventObject
): EmitExecutableActionObject {
  return {
    kind: 'emit',
    exec: execEmitEffect,
    type: event.type,
    source: actorScope.self,
    event,
    params: undefined,
    args: []
  };
}

/** @internal Creates a directly executable user effect. */
export function createCustomEffect(
  type: string,
  action: (runtime?: EffectRuntime) => void | PromiseLike<void> | undefined,
  params?: unknown
): CustomExecutableActionObject {
  return {
    kind: 'action',
    exec: action,
    type,
    action: action as () => void | PromiseLike<void>,
    params,
    args: []
  };
}

function execSpawnEffect(
  this: SpawnExecutableActionObject,
  runtime: EffectRuntime = this.actor.system
): void | PromiseLike<void> {
  return runtime.spawnActor!(this.source, this.actor);
}

function execStartEffect(
  this: StartExecutableActionObject,
  runtime: EffectRuntime = this.actor.system
): void | PromiseLike<void> {
  return runtime.startActor!(this.actor);
}

function execStopEffect(
  this: StopExecutableActionObject,
  runtime: EffectRuntime = this.source.system
): void | PromiseLike<void> {
  return runtime.stopActor!(this.actor);
}

function execTerminateEffect(
  this: TerminateExecutableActionObject,
  runtime: EffectRuntime = this.actor.system
): void | PromiseLike<void> {
  const termination: ActorTermination =
    this.status === 'done'
      ? { status: 'done', output: this.output, error: undefined }
      : { status: 'error', output: undefined, error: this.error };
  return runtime.terminateActor!(this.actor, termination);
}

function execRaiseEffect(
  this: RaiseExecutableActionObject,
  runtime: EffectRuntime = this.source.system
): void | PromiseLike<void> {
  return runtime.scheduleTimer!(this.source, this.id!, this.delay ?? 0);
}

function execSendToEffect(
  this: SendToExecutableActionObject,
  runtime: EffectRuntime = this.source.system
): void | PromiseLike<void> {
  assertSendToEvent(this.event);
  if (this.delay !== undefined) {
    return runtime.scheduleTimer!(this.source, this.id!, this.delay);
  }
  return runtime.sendEvent!(this.source, this.target, this.event);
}

function execCancelEffect(
  this: CancelExecutableActionObject,
  runtime: EffectRuntime = this.source.system
): void | PromiseLike<void> {
  return runtime.cancelTimer!(this.source, this.id);
}

function updateLogicalTimers(
  snapshot: AnyMachineSnapshot,
  effect: ExecutableActionObject,
  actorScope: AnyActorScope
): AnyMachineSnapshot {
  if (!isBuiltInExecutableAction(effect)) {
    return snapshot;
  }

  if (effect.type === '@xstate.cancel') {
    if (!snapshot.timers?.[effect.id]) {
      return snapshot;
    }
    const timers = { ...snapshot.timers };
    delete timers[effect.id];
    return { ...snapshot, timers };
  }

  if (
    (effect.type !== '@xstate.raise' && effect.type !== '@xstate.sendTo') ||
    effect.delay === undefined
  ) {
    return snapshot;
  }

  let nextTimerId = snapshot._nextTimerId ?? 0;
  const id = effect.id ?? `xstate.timer.auto.${nextTimerId++}`;
  effect.id = id;
  const target =
    effect.type === '@xstate.raise' || effect.target === actorScope.self
      ? 'self'
      : effect.target;

  return {
    ...snapshot,
    timers: {
      ...snapshot.timers,
      [id]: {
        id,
        delay: effect.delay,
        type: effect.type,
        event: effect.event,
        target
      }
    },
    _nextTimerId: nextTimerId
  };
}

export function mergeContextPatch(
  context: MachineContext,
  patch: MachineContext
): MachineContext {
  return { ...context, ...patch };
}

function pushBuiltInAction(actions: any[], action: any, ...args: any[]) {
  const actionRecord: TransitionActionRecord = { action, args };
  actions.push(actionRecord as AnyAction);
  return actionRecord;
}

function applyChildUpdate(
  snapshot: AnyMachineSnapshot,
  update: NonNullable<TransitionActionRecord['childUpdate']>,
  actorScope: AnyActorScope
): AnyMachineSnapshot {
  if (update.type === 'add') {
    return {
      ...snapshot,
      children: { ...snapshot.children, [update.id]: update.actor }
    };
  }

  const children = { ...snapshot.children };
  let owned = update.actor._parent === actorScope.self;
  for (const key of Object.keys(children)) {
    if (children[key] === update.actor) {
      owned = true;
      delete children[key];
    }
  }
  if (!owned) {
    throw new Error(
      isDevelopment
        ? `Cannot stop child actor ${update.actor.id} of ${actorScope.self.id} because it is not a child`
        : `Cannot stop non-child actor ${update.actor.id}`
    );
  }
  actorScope.system._unregister(update.actor);
  return { ...snapshot, children };
}

function getTransitionActionRecord(
  action: AnyAction
): TransitionActionRecord | undefined {
  if (
    typeof action === 'object' &&
    action !== null &&
    'action' in action &&
    typeof action.action === 'function'
  ) {
    return action as TransitionActionRecord;
  }
  return undefined;
}

function pushSpawnedChild(
  actions: any[],
  actor: AnyActor,
  id: string | undefined
) {
  const action = pushBuiltInAction(
    actions,
    builtInActions['@xstate.spawn'],
    actor
  );
  action.childUpdate = { type: 'add', actor, id: id ?? actor.id };
}

export function createTransitionEnqueue(
  actorScope: AnyActorScope,
  actions: any[],
  internalEvents: EventObject[],
  actorSubscriptions = false,
  createActors = true
) {
  const props: Partial<EnqueueObject<any, any>> = {
    cancel: (id: string) => {
      pushBuiltInAction(
        actions,
        builtInActions['@xstate.cancel'],
        actorScope,
        id
      );
    },
    emit: (emittedEvent) => {
      actions.push(emittedEvent);
    },
    log: (...args) => {
      pushBuiltInAction(actions, actorScope.logger, ...args);
    },
    raise: (raisedEvent, options) => {
      if (typeof raisedEvent === 'string') {
        throw new Error(
          isDevelopment
            ? `Only event objects may be used with raise; use raise({ type: "${raisedEvent}" }) instead`
            : `Only event objects may be used with raise`
        );
      }
      if (options?.delay !== undefined) {
        pushBuiltInAction(
          actions,
          builtInActions['@xstate.raise'],
          actorScope,
          raisedEvent,
          options
        );
      } else {
        internalEvents.push(raisedEvent);
      }
    },
    spawn: (logic, options) => {
      if (!createActors) {
        // TODO: replace this speculative placeholder with a typed inert actor ref.
        return {
          id: options?.id ?? options?.registryKey ?? (logic as any).id
        } as AnyActor;
      }
      const actor = actorScope.system.createActorRef(logic, {
        ...options,
        parent: actorScope.self
      });
      pushSpawnedChild(actions, actor, options?.id);
      return actor;
    },
    sendTo: (actor, event, options) => {
      if (!actor) {
        internalEvents.push(
          createErrorPlatformEvent('communication', {
            message: 'Unable to send event to an undefined actor',
            event
          })
        );
        return;
      }
      pushBuiltInAction(
        actions,
        builtInActions['@xstate.sendTo'],
        actorScope,
        actor,
        event,
        options
      );
    },
    stop: (actor) => {
      if (actor) {
        const action = pushBuiltInAction(
          actions,
          builtInActions['@xstate.stop'],
          actorScope,
          actor
        );
        action.childUpdate = { type: 'remove', actor };
      }
    }
  };

  if (actorSubscriptions) {
    Object.assign(props, {
      listen: (actor: any, eventType: string, mapper: any) => {
        const input: ListenerInput<any, any> = {
          actor,
          eventType,
          mapper
        };
        const listenerActor = actorScope.system.createActorRef(listenerLogic, {
          input,
          parent: actorScope.self
        });
        pushBuiltInAction(
          actions,
          builtInActions['@xstate.spawn'],
          listenerActor
        );
        return listenerActor;
      },
      subscribeTo: (actor: any, mappers: any) => {
        const normalizedMappers: SubscriptionMappers<any, any, any> =
          typeof mappers === 'function' ? { snapshot: mappers } : mappers;

        const input: SubscriptionInput<any, any, any, any> = {
          actor,
          mappers: normalizedMappers
        };
        const subscriptionActor = actorScope.system.createActorRef(
          subscriptionLogic,
          {
            input,
            parent: actorScope.self
          }
        );
        pushBuiltInAction(
          actions,
          builtInActions['@xstate.spawn'],
          subscriptionActor
        );
        return subscriptionActor;
      }
    });
  }

  return createEnqueueObject(props, (action, ...args) => {
    pushBuiltInAction(actions, action, ...args);
  });
}

function getBuiltInActionFields(
  action: (...args: any[]) => void,
  args: unknown[]
): Partial<SpecialExecutableAction> | undefined {
  switch (action) {
    case builtInActions['@xstate.spawn']: {
      const [actor] = args as Parameters<
        (typeof builtInActions)['@xstate.spawn']
      >;
      return {
        kind: 'builtin',
        exec: execSpawnEffect,
        source: actor._parent,
        actor,
        id: actor.id,
        logic: (actor as any).logic,
        src: actor.src,
        input: (actor as any).options?.input
      };
    }
    case builtInActions['@xstate.raise']: {
      const [, event, options] = args as Parameters<
        (typeof builtInActions)['@xstate.raise']
      >;
      return {
        kind: 'builtin',
        exec: execRaiseEffect,
        source: (
          args as Parameters<(typeof builtInActions)['@xstate.raise']>
        )[0].self,
        event,
        id: options?.id,
        delay: options?.delay
      };
    }
    case builtInActions['@xstate.sendTo']: {
      const [, target, event, options] = args as Parameters<
        (typeof builtInActions)['@xstate.sendTo']
      >;
      return {
        kind: 'builtin',
        exec: execSendToEffect,
        source: (
          args as Parameters<(typeof builtInActions)['@xstate.sendTo']>
        )[0].self,
        target,
        event,
        id: options?.id,
        delay: options?.delay
      };
    }
    case builtInActions['@xstate.cancel']: {
      const [, id] = args as Parameters<
        (typeof builtInActions)['@xstate.cancel']
      >;
      return {
        kind: 'builtin',
        exec: execCancelEffect,
        source: (
          args as Parameters<(typeof builtInActions)['@xstate.cancel']>
        )[0].self,
        id
      };
    }
    case builtInActions['@xstate.stop']: {
      const [, actor] = args as Parameters<
        (typeof builtInActions)['@xstate.stop']
      >;
      return {
        kind: 'builtin',
        exec: execStopEffect,
        source: (args as Parameters<(typeof builtInActions)['@xstate.stop']>)[0]
          .self,
        actor,
        id: actor.id
      };
    }
    default:
      return undefined;
  }
}

function createStartEffect(actor: AnyActor): StartExecutableActionObject {
  const args: Parameters<(typeof builtInActions)['@xstate.start']> = [actor];
  return {
    kind: 'builtin',
    exec: execStartEffect,
    type: XSTATE_START,
    source: actor._parent,
    params: undefined,
    args,
    actor,
    id: actor.id
  };
}

export function createSpawnEffect(
  actor: AnyActor
): SpawnExecutableActionObject {
  const args: Parameters<(typeof builtInActions)['@xstate.spawn']> = [actor];
  return {
    kind: 'builtin',
    exec: execSpawnEffect,
    type: XSTATE_SPAWN,
    source: actor._parent,
    params: undefined,
    args,
    actor,
    id: actor.id,
    logic: (actor as any).logic,
    src: actor.src,
    input: (actor as any).options?.input
  };
}

/** @internal Creates an immediate actor-to-actor delivery effect. */
export function createSendToEffect(
  actorScope: AnyActorScope,
  target: AnyActor,
  event: EventObject
): SendToExecutableActionObject {
  const args: Parameters<(typeof builtInActions)['@xstate.sendTo']> = [
    actorScope,
    target,
    event,
    {}
  ];
  return {
    kind: 'builtin',
    exec: execSendToEffect,
    type: '@xstate.sendTo',
    source: actorScope.self,
    target,
    event,
    id: undefined,
    delay: undefined,
    params: undefined,
    args
  };
}

/** @internal Creates the terminal lifecycle effect for an actor. */
export function createTerminationEffect(
  actorScope: AnyActorScope,
  snapshot: Snapshot<unknown>
): TerminateExecutableActionObject {
  if (snapshot.status !== 'done' && snapshot.status !== 'error') {
    throw new Error('Cannot terminate an active or stopped actor');
  }
  const termination: ActorTermination =
    snapshot.status === 'done'
      ? { status: 'done', output: snapshot.output, error: undefined }
      : { status: 'error', output: undefined, error: snapshot.error };
  const args: Parameters<(typeof builtInActions)['@xstate.terminate']> = [
    actorScope.self,
    termination
  ];
  return {
    kind: 'builtin',
    exec: execTerminateEffect,
    type: XSTATE_TERMINATE,
    source: actorScope.self,
    actor: actorScope.self,
    id: actorScope.self.id,
    ...termination,
    params: undefined,
    args
  };
}

/**
 * Ensures that a newly terminal snapshot has exactly one ordered actor
 * termination effect.
 *
 * @internal
 */
export function finalizeTransitionResult<
  TSnapshot extends Snapshot<unknown>,
  TEffect
>(
  actorScope: AnyActorScope,
  previousSnapshot: TSnapshot | undefined,
  [nextSnapshot, effects]: [TSnapshot, TEffect[]]
): [TSnapshot, Array<TEffect | TerminateExecutableActionObject>] {
  const becameTerminal =
    nextSnapshot.status === 'done' || nextSnapshot.status === 'error';
  const wasTerminal =
    previousSnapshot?.status === 'done' || previousSnapshot?.status === 'error';
  const hasTerminationEffect = effects.some(
    (effect) =>
      typeof effect === 'object' &&
      effect !== null &&
      'type' in effect &&
      effect.type === XSTATE_TERMINATE
  );

  return becameTerminal && !wasTerminal && !hasTerminationEffect
    ? [
        nextSnapshot,
        [...effects, createTerminationEffect(actorScope, nextSnapshot)]
      ]
    : [nextSnapshot, effects];
}

/**
 * Attached (listener/subscription) starts are ordered before child starts so
 * that a listener/subscription captures events emitted synchronously as its
 * target actor starts.
 */
export function deriveDeferredStarts(
  effects: ReadonlyArray<ExecutableActionObject>
): StartExecutableActionObject[] {
  const attachedStarts: StartExecutableActionObject[] = [];
  const childStarts: StartExecutableActionObject[] = [];

  for (const effect of effects) {
    if (!isBuiltInExecutableAction(effect) || effect.type !== XSTATE_SPAWN) {
      continue;
    }
    const { actor, logic } = effect;
    const start = createStartEffect(actor);
    if (logic === listenerLogic || logic === subscriptionLogic) {
      attachedStarts.push(start);
    } else {
      childStarts.push(start);
    }
  }

  return [...attachedStarts, ...childStarts];
}

export function isBuiltInExecutableAction(
  action: ExecutableActionObject
): action is SpecialExecutableAction {
  return action.kind === 'builtin';
}

/** Executes transition effects sequentially, awaiting each runtime operation. */
export async function executeEffects(
  effects: readonly ExecutableActionObject[],
  runtime?: Partial<ActorSystemRuntime>
): Promise<void> {
  for (const effect of effects) {
    await effect.exec(runtime);
  }
}

export function resolveActionsWithContext(
  currentSnapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  actions: AnyAction[]
): [AnyMachineSnapshot, ExecutableActionObject[]] {
  let intermediateSnapshot = currentSnapshot;
  const executableActions: ExecutableActionObject[] = [];

  for (const action of actions) {
    const actionArgs = {
      context: intermediateSnapshot.context,
      event,
      output: getEventOutput(event),
      self: actorScope.self,
      system: actorScope.system,
      children: intermediateSnapshot.children,
      parent: actorScope.self._parent,
      actions: currentSnapshot.machine.implementations.actions,
      actorSources: currentSnapshot.machine.implementations.actorSources
    };

    const isInline = typeof action === 'function';
    const actionRecord = getTransitionActionRecord(action);

    const resolvedAction = isInline
      ? action
      : actionRecord
        ? actionRecord.action.bind(null, ...actionRecord.args)
        : false;

    let actionParams = undefined;

    if (typeof action === 'object' && action !== null) {
      const {
        type: _,
        childUpdate: _childUpdate,
        ...emittedEventParams
      } = action as any;
      actionParams = emittedEventParams;
    }

    if (actionRecord?.childUpdate) {
      intermediateSnapshot = applyChildUpdate(
        intermediateSnapshot,
        actionRecord.childUpdate,
        actorScope
      );
    }

    if (resolvedAction && '_special' in resolvedAction) {
      executableActions.push({
        kind: 'action',
        exec: execCustomEffect,
        type:
          typeof action === 'object'
            ? 'action' in action && typeof action.action === 'function'
              ? (action.action.name ?? '(anonymous)')
              : ((action as any).type ?? '(anonymous)')
            : action.name || '(anonymous)',
        params: actionParams,
        args: [],
        action: undefined
      });

      const specialAction = resolvedAction as unknown as Action<
        any,
        any,
        any,
        any,
        any,
        any,
        any
      >;

      const res = specialAction(actionArgs as any, emptyEnqueueObject);

      if (res && ('context' in res || 'children' in res)) {
        // Special-action patches never change `_nodes`, so a shallow clone is
        // equivalent to `cloneMachineSnapshot` — and keeps this module (and
        // non-machine logic like `createFSM`) independent of State.ts.
        intermediateSnapshot = {
          ...intermediateSnapshot,
          ...(res.context !== undefined
            ? {
                context: mergeContextPatch(
                  intermediateSnapshot.context,
                  res.context
                )
              }
            : {}),
          ...('children' in res ? { children: res.children } : {})
        };
      }
      continue;
    }

    if (!resolvedAction || !('resolve' in resolvedAction)) {
      const builtInFields =
        typeof action === 'object' &&
        action !== null &&
        'action' in action &&
        typeof action.action === 'function'
          ? getBuiltInActionFields(action.action, action.args)
          : undefined;
      const isEmittedEvent =
        typeof action === 'object' && action !== null && !actionRecord;

      const executableAction = {
        kind: builtInFields
          ? ('builtin' as const)
          : isEmittedEvent
            ? ('emit' as const)
            : ('action' as const),
        type:
          typeof action === 'object'
            ? 'action' in action && typeof action.action === 'function'
              ? (action.action.name ?? '(anonymous)')
              : (action as AnyEventObject).type
            : action.name || '(anonymous)',
        params: builtInFields ? undefined : actionParams,
        args:
          typeof action === 'object' && 'action' in action ? action.args : [],
        ...(builtInFields
          ? {}
          : isEmittedEvent
            ? { source: actorScope.self, event: action }
            : {
                action: actionRecord?.action ?? (isInline ? action : undefined)
              }),
        ...(!builtInFields
          ? { exec: isEmittedEvent ? execEmitEffect : execCustomEffect }
          : {}),
        ...builtInFields
      };

      const typedExecutableAction = executableAction as ExecutableActionObject;
      intermediateSnapshot = updateLogicalTimers(
        intermediateSnapshot,
        typedExecutableAction,
        actorScope
      );
      executableActions.push(typedExecutableAction);
      continue;
    }
  }

  return [intermediateSnapshot, executableActions];
}

export function createEnqueueObject(
  props: Partial<EnqueueObject<any, any>>,
  action: <T extends (...args: any[]) => any>(
    fn: T,
    ...args: Parameters<T>
  ) => void
): EnqueueObject<any, any> {
  const enqueueFn = (
    fn: (...args: any[]) => any,
    ...args: Parameters<typeof fn>
  ) => {
    action(fn, ...args);
  };

  Object.assign(enqueueFn, {
    cancel: () => {},
    emit: () => {},
    log: () => {},
    raise: () => {},
    spawn: () => ({}) as any,
    sendTo: () => {},
    stop: () => {},
    listen: () => ({}) as any,
    subscribeTo: () => ({}) as any,
    ...props
  });

  return enqueueFn as any;
}

const emptyEnqueueObject = createEnqueueObject({}, () => {});
