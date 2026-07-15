import isDevelopment from '#is-development';
import { builtInActions } from './actions.ts';
import { listenerLogic, type ListenerInput } from './actors/listener.ts';
import {
  subscriptionLogic,
  type SubscriptionInput,
  type SubscriptionMappers
} from './actors/subscription.ts';
import { XSTATE_SPAWN, XSTATE_START } from './constants.ts';
import { createActor } from './createActor.ts';
import { createErrorPlatformEvent } from './eventUtils.ts';
import { getEventOutput } from './utils.ts';
import type {
  Action,
  AnyAction,
  AnyActor,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  EnqueueObject,
  EventObject,
  ExecutableActionObject,
  MachineContext,
  SpecialExecutableAction,
  SpawnExecutableActionObject,
  StartExecutableActionObject
} from './types.ts';

const builtInExecutableAction = Symbol('xstate.builtInExecutableAction');

type TransitionActionRecord = {
  action: (...args: any[]) => any;
  args: any[];
  childUpdate?:
    | { type: 'add'; actor: AnyActor; id: string }
    | { type: 'remove'; actor: AnyActor };
};

function brandBuiltInExecutableAction<T extends object>(action: T): T {
  Object.defineProperty(action, builtInExecutableAction, { value: true });
  return action;
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
      const actor = createActor(logic, {
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
        const listenerActor = createActor(listenerLogic, {
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
        const subscriptionActor = createActor(subscriptionLogic, {
          input,
          parent: actorScope.self
        });
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
      return { id };
    }
    case builtInActions['@xstate.stop']: {
      const [, actor] = args as Parameters<
        (typeof builtInActions)['@xstate.stop']
      >;
      return { actor, id: actor.id };
    }
    default:
      return undefined;
  }
}

function createStartEffect(actor: AnyActor): StartExecutableActionObject {
  const action = builtInActions['@xstate.start'];
  const args: Parameters<(typeof builtInActions)['@xstate.start']> = [actor];
  return brandBuiltInExecutableAction({
    type: XSTATE_START,
    params: { action, args },
    args,
    exec: action.bind(null, actor),
    actor,
    id: actor.id
  });
}

export function createSpawnEffect(
  actor: AnyActor
): SpawnExecutableActionObject {
  const action = builtInActions['@xstate.spawn'];
  const args: Parameters<(typeof builtInActions)['@xstate.spawn']> = [actor];
  return brandBuiltInExecutableAction({
    type: XSTATE_SPAWN,
    params: { action, args },
    args,
    exec: action.bind(null, actor),
    actor,
    id: actor.id,
    logic: (actor as any).logic,
    src: actor.src,
    input: (actor as any).options?.input
  });
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
  return (action as any)[builtInExecutableAction] === true;
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
        type:
          typeof action === 'object'
            ? 'action' in action && typeof action.action === 'function'
              ? (action.action.name ?? '(anonymous)')
              : ((action as any).type ?? '(anonymous)')
            : action.name || '(anonymous)',
        params: actionParams,
        args: [],
        exec: undefined
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

      const executableAction = {
        type:
          typeof action === 'object'
            ? 'action' in action && typeof action.action === 'function'
              ? (action.action.name ?? '(anonymous)')
              : (action as AnyEventObject).type
            : action.name || '(anonymous)',
        params: actionParams,
        args:
          typeof action === 'object' && 'action' in action ? action.args : [],
        exec:
          resolvedAction ||
          (typeof action === 'object' && action !== null
            ? () => actorScope.emit(action)
            : undefined),
        ...builtInFields
      };

      executableActions.push(
        builtInFields
          ? brandBuiltInExecutableAction(executableAction)
          : executableAction
      );
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
