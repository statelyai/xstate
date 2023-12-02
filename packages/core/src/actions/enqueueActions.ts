import isDevelopment from '#is-development';
import { Guard, evaluateGuard } from '../guards.ts';
import {
  Action,
  ActionArgs,
  AnyActorRef,
  AnyActorScope,
  AnyMachineSnapshot,
  EventObject,
  MachineContext,
  ParameterizedObject,
  ProvidedActor
} from '../types.ts';
import { assign } from './assign.ts';
import { cancel } from './cancel.ts';
import { raise } from './raise.ts';
import { sendTo } from './send.ts';
import { spawnChild } from './spawnChild.ts';
import { stopChild } from './stopChild.ts';

interface ActionEnqueuer<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> {
  (
    action: Action<
      TContext,
      TExpressionEvent,
      TEvent,
      undefined,
      TActor,
      TAction,
      TGuard,
      TDelay
    >
  ): void;
  assign: (
    ...args: Parameters<
      typeof assign<TContext, TExpressionEvent, undefined, TEvent, TActor>
    >
  ) => void;
  cancel: (
    ...args: Parameters<
      typeof cancel<TContext, TExpressionEvent, undefined, TEvent>
    >
  ) => void;
  raise: (
    ...args: Parameters<
      typeof raise<TContext, TExpressionEvent, TEvent, undefined, TDelay>
    >
  ) => void;
  sendTo: <TTargetActor extends AnyActorRef>(
    ...args: Parameters<
      typeof sendTo<
        TContext,
        TExpressionEvent,
        undefined,
        TTargetActor,
        TEvent,
        TDelay
      >
    >
  ) => void;
  spawnChild: (
    ...args: Parameters<
      typeof spawnChild<TContext, TExpressionEvent, undefined, TEvent, TActor>
    >
  ) => void;
  stopChild: (
    ...args: Parameters<
      typeof stopChild<TContext, TExpressionEvent, undefined, TEvent>
    >
  ) => void;
}

function resolveEnqueueActions(
  _: AnyActorScope,
  snapshot: AnyMachineSnapshot,
  args: ActionArgs<any, any, any>,
  _actionParams: ParameterizedObject['params'] | undefined,
  {
    collect
  }: {
    collect: ({
      context,
      event,
      enqueue,
      check
    }: {
      context: MachineContext;
      event: EventObject;
      enqueue: ActionEnqueuer<
        MachineContext,
        EventObject,
        EventObject,
        ProvidedActor,
        ParameterizedObject,
        ParameterizedObject,
        string
      >;
      check: (
        guard: Guard<
          MachineContext,
          EventObject,
          undefined,
          ParameterizedObject
        >
      ) => boolean;
    }) => void;
  }
) {
  const actions: any[] = [];
  const enqueue: Parameters<typeof collect>[0]['enqueue'] = function enqueue(
    action
  ) {
    actions.push(action);
  };
  enqueue.assign = (...args) => {
    actions.push(assign(...args));
  };
  enqueue.cancel = (...args) => {
    actions.push(cancel(...args));
  };
  enqueue.raise = (...args) => {
    actions.push(raise(...args));
  };
  enqueue.sendTo = (...args) => {
    actions.push(sendTo(...args));
  };
  enqueue.spawnChild = (...args) => {
    actions.push(spawnChild(...args));
  };
  enqueue.stopChild = (...args) => {
    actions.push(stopChild(...args));
  };

  collect({
    context: args.context,
    event: args.event,
    enqueue,
    check: (guard) =>
      evaluateGuard(guard, snapshot.context, args.event, snapshot)
  });

  return [snapshot, undefined, actions];
}

export interface EnqueueActionsAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string
> {
  (args: ActionArgs<TContext, TExpressionEvent, TEvent>, params: unknown): void;
  _out_TEvent?: TEvent;
  _out_TActor?: TActor;
  _out_TAction?: TAction;
  _out_TGuard?: TGuard;
  _out_TDelay?: TDelay;
}

export function enqueueActions<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject = TExpressionEvent,
  TActor extends ProvidedActor = ProvidedActor,
  TAction extends ParameterizedObject = ParameterizedObject,
  TGuard extends ParameterizedObject = ParameterizedObject,
  TDelay extends string = string
>(
  collect: ({
    context,
    event,
    check,
    enqueue
  }: {
    context: TContext;
    event: TExpressionEvent;
    check: (
      guard: Guard<TContext, TExpressionEvent, undefined, TGuard>
    ) => boolean;
    enqueue: ActionEnqueuer<
      TContext,
      TExpressionEvent,
      TEvent,
      TActor,
      TAction,
      TGuard,
      TDelay
    >;
  }) => void
): EnqueueActionsAction<
  TContext,
  TExpressionEvent,
  TEvent,
  TActor,
  TAction,
  TGuard,
  TDelay
> {
  function enqueueActions(
    args: ActionArgs<TContext, TExpressionEvent, TEvent>,
    params: unknown
  ) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  enqueueActions.type = 'xstate.enqueueActions';
  enqueueActions.collect = collect;

  enqueueActions.resolve = resolveEnqueueActions;

  return enqueueActions;
}
