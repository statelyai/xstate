import isDevelopment from '#is-development';
import { builtInActions } from './actions.ts';
import { listenerLogic, type ListenerInput } from './actors/listener.ts';
import {
  subscriptionLogic,
  type SubscriptionInput,
  type SubscriptionMappers
} from './actors/subscription.ts';
import { createActor } from './createActor.ts';
import { cloneMachineSnapshot } from './State.ts';
import type {
  Action,
  AnyAction,
  AnyActor,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  EnqueueObject,
  EventObject
} from './types.ts';

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
  actorSubscriptions = false
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
      const actor = createActor(logic, {
        ...options,
        parent: actorScope.self
      });
      pushStartedChild(actions, actor, options?.id);
      return actor;
    },
    sendTo: (actor, event, options) => {
      if (actor) {
        pushBuiltInAction(
          actions,
          builtInActions['@xstate.sendTo'],
          actorScope,
          actor,
          event,
          options
        );
      }
    },
    stop: (actor) => {
      if (actor) {
        pushBuiltInAction(
          actions,
          builtInActions['@xstate.stopChild'],
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

export function resolveAndExecuteActionsWithContext(
  currentSnapshot: AnyMachineSnapshot,
  event: AnyEventObject,
  actorScope: AnyActorScope,
  actions: AnyAction[]
): AnyMachineSnapshot {
  let intermediateSnapshot = currentSnapshot;

  for (const action of actions) {
    const isInline = typeof action === 'function';

    const resolvedAction = isInline
      ? action
      : typeof action === 'object' &&
          'action' in action &&
          typeof action.action === 'function'
        ? action.action.bind(null, ...action.args)
        : false;

    if (!resolvedAction && typeof action === 'object' && action !== null) {
      actorScope.defer(() => {
        actorScope.emit(action);
      });
    }

    const actionArgs = {
      context: intermediateSnapshot.context,
      event,
      self: actorScope.self,
      system: actorScope.system,
      children: intermediateSnapshot.children,
      parent: actorScope.self._parent,
      actions: currentSnapshot.machine.implementations.actions,
      actors: currentSnapshot.machine.implementations.actors
    };

    let actionParams = undefined;

    if (typeof action === 'object' && action !== null) {
      const { type: _, ...emittedEventParams } = action as any;
      actionParams = emittedEventParams;
    }

    if (resolvedAction && '_special' in resolvedAction) {
      actorScope.actionExecutor({
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
          ...('context' in res ? { context: res.context } : {}),
          ...('children' in res ? { children: res.children } : {})
        });
      }
      continue;
    }

    if (!resolvedAction || !('resolve' in resolvedAction)) {
      actorScope.actionExecutor({
        type:
          typeof action === 'object'
            ? 'action' in action && typeof action.action === 'function'
              ? (action.action.name ?? '(anonymous)')
              : (action as AnyEventObject).type
            : action.name || '(anonymous)',
        params: actionParams,
        args:
          typeof action === 'object' && 'action' in action ? action.args : [],
        exec: resolvedAction
      });
      continue;
    }
  }

  return intermediateSnapshot;
}

function createEnqueueObject(
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
