import { XSTATE_STOP } from '../constants.ts';
import { createInitEvent } from '../eventUtils.ts';
import { StandardSchemaV1 } from '../schema.types.ts';
import { AnyActorSystem } from '../system.ts';
import {
  ActorLogic,
  ActorRefFromLogic,
  ActorScope,
  AnyActorRef,
  EventObject,
  NonReducibleUnknown,
  Snapshot
} from '../types.ts';

export type LogicSnapshot<TContext, TOutput, TInput> = Snapshot<TOutput> & {
  context: TContext;
  input: TInput | undefined;
  effects?: Record<string, LogicEffectState>;
};

export type LogicEffectState =
  | { status: 'active' }
  | { status: 'done'; output?: unknown }
  | { status: 'error'; error: unknown };

export interface LogicArgs<TContext, TEvent extends EventObject, TInput> {
  context: TContext;
  event: TEvent;
  input: TInput;
  system: AnyActorSystem;
  self: LogicActorRef<TContext, unknown, TEvent, TInput>;
}

export type LogicEffect<
  TEvent extends EventObject,
  TEmitted extends EventObject
> =
  | { type: 'emit'; event: TEmitted }
  | { type: 'sendBack'; event: EventObject }
  | { type: 'raise'; event: TEvent }
  | { type: 'effect'; key?: string; exec: () => void | (() => void) }
  | { type: 'cleanupEffects' };

export interface LogicEnqueue<
  TEvent extends EventObject,
  TEmitted extends EventObject
> {
  emit: (emitted: TEmitted) => void;
  sendBack: (event: EventObject) => void;
  raise: (event: TEvent) => void;
  effect: {
    (exec: () => void | (() => void)): void;
    (key: string, exec: () => void | (() => void)): void;
  };
}

export type LogicPatch<TContext, TOutput, TInput> = Partial<{
  context: TContext;
  input: TInput | undefined;
  status: LogicSnapshot<TContext, TOutput, TInput>['status'];
  output: TOutput;
  error: unknown;
  effects: Record<string, LogicEffectState>;
}>;

export type LogicFunction<
  TContext,
  TOutput,
  TEvent extends EventObject,
  TInput,
  TEmitted extends EventObject
> = (
  args: LogicArgs<TContext, TEvent, TInput>,
  enq: LogicEnqueue<TEvent, TEmitted>
) => void | LogicPatch<TContext, TOutput, TInput>;

export interface LogicConfig<
  TContext,
  TOutput,
  TEvent extends EventObject,
  TInput,
  TEmitted extends EventObject,
  TInputSchema extends StandardSchemaV1 = StandardSchemaV1
> {
  id?: string;
  schemas?: {
    input?: TInputSchema;
  };
  context: TContext | ((args: { input: TInput }) => TContext);
  run: LogicFunction<TContext, TOutput, TEvent, TInput, TEmitted>;
}

export interface LogicTransition<
  TContext,
  TOutput,
  TEvent extends EventObject,
  TInput,
  TEmitted extends EventObject
> {
  (
    snapshot: LogicSnapshot<TContext, TOutput, TInput>,
    event: TEvent,
    actorScope: ActorScope<
      LogicSnapshot<TContext, TOutput, TInput>,
      TEvent,
      AnyActorSystem,
      TEmitted
    >
  ): [
    LogicSnapshot<TContext, TOutput, TInput>,
    LogicEffect<TEvent, TEmitted>[]
  ];
  (
    snapshot: LogicSnapshot<TContext, TOutput, TInput>,
    event: TEvent,
    actorScope: ActorScope<
      LogicSnapshot<TContext, TOutput, TInput>,
      TEvent,
      AnyActorSystem,
      TEmitted
    >
  ): LogicSnapshot<TContext, TOutput, TInput>;
}

export type LogicActorLogic<
  TContext,
  TOutput,
  TEvent extends EventObject = EventObject,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
> = Omit<
  ActorLogic<
    LogicSnapshot<TContext, TOutput, TInput>,
    TEvent,
    TInput,
    AnyActorSystem,
    TEmitted
  >,
  'transition'
> & {
  id?: string;
  transition: LogicTransition<TContext, TOutput, TEvent, TInput, TEmitted>;
};

export type LogicActorRef<
  TContext,
  TOutput,
  TEvent extends EventObject,
  TInput
> = ActorRefFromLogic<LogicActorLogic<TContext, TOutput, TEvent, TInput>>;

const effectStates = new WeakMap<
  AnyActorRef,
  Map<PropertyKey, { cleanup?: () => void }>
>();

export const XSTATE_LOGIC_EFFECT_RESOLVE = 'xstate.logic.effect.resolve';
export const XSTATE_LOGIC_EFFECT_REJECT = 'xstate.logic.effect.reject';
export const XSTATE_LOGIC_EFFECT_START = 'xstate.logic.effect.start';

function getEffectState(self: AnyActorRef) {
  let state = effectStates.get(self);
  if (!state) {
    state = new Map();
    effectStates.set(self, state);
  }
  return state;
}

export function executeLogicEffects(
  effects: readonly unknown[] | undefined,
  actorScope: ActorScope<any, any, any, any>
) {
  if (!effects?.length) {
    return;
  }

  for (const effect of effects as LogicEffect<EventObject, EventObject>[]) {
    switch (effect.type) {
      case 'emit':
        actorScope.emit(effect.event);
        break;
      case 'sendBack': {
        const parent = (actorScope.self as any)._parent;
        if (parent) {
          actorScope.system._relay(actorScope.self, parent, effect.event);
        }
        break;
      }
      case 'raise':
        actorScope.system._relay(
          actorScope.self,
          actorScope.self,
          effect.event
        );
        break;
      case 'effect': {
        if (!effect.key) {
          const cleanup = effect.exec();
          if (typeof cleanup === 'function') {
            getEffectState(actorScope.self).set(Symbol(), { cleanup });
          }
          break;
        }

        const state = getEffectState(actorScope.self);
        if (state.has(effect.key)) {
          break;
        }
        const cleanup = effect.exec();
        state.set(effect.key, {
          cleanup: typeof cleanup === 'function' ? cleanup : undefined
        });
        break;
      }
      case 'cleanupEffects': {
        const state = effectStates.get(actorScope.self);
        if (!state) {
          break;
        }
        for (const { cleanup } of state.values()) {
          cleanup?.();
        }
        effectStates.delete(actorScope.self);
        break;
      }
    }
  }
}

function resolveContext<TContext, TInput>(
  context: TContext | ((args: { input: TInput }) => TContext),
  input: TInput
) {
  return typeof context === 'function'
    ? (context as (args: { input: TInput }) => TContext)({ input })
    : context;
}

export function createLogic<
  TContext,
  TOutput,
  const TInputSchema extends StandardSchemaV1,
  TEvent extends EventObject = EventObject,
  TEmitted extends EventObject = EventObject
>(
  config: LogicConfig<
    TContext,
    TOutput,
    TEvent,
    StandardSchemaV1.InferOutput<TInputSchema>,
    TEmitted,
    TInputSchema
  > & {
    schemas: {
      input: TInputSchema;
    };
  }
): LogicActorLogic<
  TContext,
  TOutput,
  TEvent,
  StandardSchemaV1.InferOutput<TInputSchema>,
  TEmitted
>;
export function createLogic<
  TContext,
  TOutput = unknown,
  TEvent extends EventObject = EventObject,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  config: LogicConfig<TContext, TOutput, TEvent, TInput, TEmitted>
): LogicActorLogic<TContext, TOutput, TEvent, TInput, TEmitted>;
export function createLogic<
  TContext,
  TOutput = unknown,
  TEvent extends EventObject = EventObject,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  config: LogicConfig<TContext, TOutput, TEvent, TInput, TEmitted>
): LogicActorLogic<TContext, TOutput, TEvent, TInput, TEmitted> {
  const transition = ((snapshot, event, actorScope) => {
    if (snapshot.status !== 'active') {
      return [snapshot, []];
    }

    if (event.type === XSTATE_STOP) {
      return [
        {
          ...snapshot,
          status: 'stopped',
          input: undefined
        },
        [{ type: 'cleanupEffects' }]
      ];
    }

    if (event.type === XSTATE_LOGIC_EFFECT_START) {
      return [
        {
          ...snapshot,
          effects: {
            ...snapshot.effects,
            [(event as any).key]: { status: 'active' }
          }
        },
        []
      ];
    }

    if (event.type === XSTATE_LOGIC_EFFECT_RESOLVE) {
      return [
        {
          ...snapshot,
          effects: {
            ...snapshot.effects,
            [(event as any).key]: {
              status: 'done',
              output: (event as any).output
            }
          }
        },
        []
      ];
    }

    if (event.type === XSTATE_LOGIC_EFFECT_REJECT) {
      return [
        {
          ...snapshot,
          effects: {
            ...snapshot.effects,
            [(event as any).key]: {
              status: 'error',
              error: (event as any).error
            }
          }
        },
        []
      ];
    }

    const effects: LogicEffect<TEvent, TEmitted>[] = [];
    const trackedEffects: Record<string, LogicEffectState> = {};
    const enqueueEffect = (key: string, exec: () => void | (() => void)) => {
      if (snapshot.effects?.[key]) {
        return;
      }
      effects.push({ type: 'effect', key, exec });
      trackedEffects[key] = { status: 'active' };
    };
    const enq: LogicEnqueue<TEvent, TEmitted> = {
      emit: (emitted) => {
        effects.push({ type: 'emit', event: emitted });
      },
      sendBack: (sentEvent) => {
        effects.push({ type: 'sendBack', event: sentEvent });
      },
      raise: (raisedEvent) => {
        effects.push({ type: 'raise', event: raisedEvent });
      },
      effect: ((keyOrExec, maybeExec) => {
        if (typeof keyOrExec === 'string') {
          enqueueEffect(keyOrExec, maybeExec!);
          return;
        }
        effects.push({ type: 'effect', exec: keyOrExec });
      }) as LogicEnqueue<TEvent, TEmitted>['effect']
    };

    const patch = config.run(
      {
        context: snapshot.context,
        event,
        input: snapshot.input!,
        system: actorScope.system,
        self: actorScope.self as any,
        emit: actorScope.emit
      } as LogicArgs<TContext, TEvent, TInput>,
      enq
    );

    const nextSnapshot = {
      ...snapshot,
      ...(patch || {})
    };

    if ('context' in snapshot || patch?.context !== undefined) {
      (nextSnapshot as any).context = patch?.context ?? snapshot.context;
    }
    if (patch?.effects || Object.keys(trackedEffects).length) {
      (nextSnapshot as any).effects = {
        ...snapshot.effects,
        ...patch?.effects,
        ...trackedEffects
      };
    }

    return [nextSnapshot, effects];
  }) as LogicTransition<TContext, TOutput, TEvent, TInput, TEmitted>;

  const logic: LogicActorLogic<TContext, TOutput, TEvent, TInput, TEmitted> = {
    id: config.id,
    config,
    transition,
    start: (snapshot, actorScope) => {
      const [nextSnapshot, effects] = transition(
        snapshot,
        createInitEvent(snapshot.input) as unknown as TEvent,
        actorScope
      );
      Object.assign(snapshot, nextSnapshot);
      executeLogicEffects(effects, actorScope);
    },
    getInitialSnapshot: (_, input) => {
      const context = resolveContext(config.context, input);
      const snapshot = {
        status: 'active' as const,
        output: undefined,
        error: undefined,
        input
      };

      if (context !== undefined) {
        (snapshot as any).context = context;
      }

      return {
        ...snapshot
      } as LogicSnapshot<TContext, TOutput, TInput>;
    },
    getPersistedSnapshot: (snapshot) => snapshot,
    restoreSnapshot: (snapshot: any) => snapshot
  };

  return logic;
}
