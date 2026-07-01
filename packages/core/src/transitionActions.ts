import isDevelopment from '#is-development';
import { builtInActions } from './actions.ts';
import { listenerLogic, type ListenerInput } from './actors/listener.ts';
import {
  subscriptionLogic,
  type SubscriptionInput,
  type SubscriptionMappers
} from './actors/subscription.ts';
import { createActor } from './createActor.ts';
import { createErrorPlatformEvent } from './eventUtils.ts';
import { cloneMachineSnapshot } from './State.ts';
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
  SpecialExecutableAction
} from './types.ts';

export function mergeContextPatch(
  context: MachineContext,
  patch: MachineContext
): MachineContext {
  return { ...context, ...patch };
}

function pushBuiltInAction(actions: any[], action: any, ...args: any[]) {
  actions.push({ action, args } as AnyAction);
}

function registerSpawnedChild(actor: AnyActor, id: string) {
  return Object.assign(
    function registerChild(args: { children: Record<string, AnyActor> }) {
      return { children: { ...args.children, [id]: actor } };
    },
    { _special: true }
  );
}

function unregisterChild(actor: AnyActor) {
  return Object.assign(
    function removeChild(args: {
      children: Record<string, AnyActor | undefined>;
    }) {
      const children = { ...args.children };
      for (const key of Object.keys(children)) {
        if (children[key] === actor) {
          delete children[key];
        }
      }
      return { children };
    },
    { _special: true }
  );
}

function pushStartedChild(
  actions: any[],
  actor: AnyActor,
  id: string | undefined
) {
  pushBuiltInAction(actions, builtInActions['@xstate.start'], actor);
  actions.push(registerSpawnedChild(actor, id ?? actor.id));
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
      pushStartedChild(actions, actor, options?.id);
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
        pushBuiltInAction(
          actions,
          builtInActions['@xstate.stop'],
          actorScope,
          actor
        );
        actions.push(unregisterChild(actor));
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
          builtInActions['@xstate.start'],
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
          builtInActions['@xstate.start'],
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
    case builtInActions['@xstate.start']: {
      const [actor] = args as Parameters<
        (typeof builtInActions)['@xstate.start']
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
      return { actor };
    }
    default:
      return undefined;
  }
}

export function isBuiltInExecutableAction(
  action: ExecutableActionObject
): action is SpecialExecutableAction {
  return Object.prototype.hasOwnProperty.call(builtInActions, action.type);
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
    const isInline = typeof action === 'function';

    const resolvedAction = isInline
      ? action
      : typeof action === 'object' &&
          'action' in action &&
          typeof action.action === 'function'
        ? action.action.bind(null, ...action.args)
        : false;

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

    let actionParams = undefined;

    if (typeof action === 'object' && action !== null) {
      const { type: _, ...emittedEventParams } = action as any;
      actionParams = emittedEventParams;
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
        intermediateSnapshot = cloneMachineSnapshot(intermediateSnapshot, {
          ...(res.context !== undefined
            ? {
                context: mergeContextPatch(
                  intermediateSnapshot.context,
                  res.context
                )
              }
            : {}),
          ...('children' in res ? { children: res.children } : {})
        });
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

      executableActions.push({
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
            ? () => actorScope.defer(() => actorScope.emit(action))
            : undefined),
        ...builtInFields
      });
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
