import { XSTATE_STOP } from '../constants.ts';
import { createInitEvent } from '../eventUtils.ts';
import { StandardSchemaV1 } from '../schema.types.ts';
import { ActorSystemRuntime, AnyActorSystem } from '../system.ts';
import {
  finalizeTransitionResult,
  createCustomEffect,
  createEmitEffect,
  createSendToEffect
} from '../transitionActions.ts';
import {
  ActorLogic,
  ActorRefFromLogic,
  ActorScope,
  AnyActorRef,
  EventObject,
  ExecutableActionObject,
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
  _TEvent extends EventObject,
  _TEmitted extends EventObject
> = ExecutableActionObject;

export interface LogicEnqueue<
  TEvent extends EventObject,
  TEmitted extends EventObject
> {
  emit: (emitted: TEmitted) => void;
  sendBack: (event: EventObject) => void;
  raise: (event: TEvent) => void;
  effect: {
    (
      exec: (runtime?: Partial<ActorSystemRuntime>) => void | (() => void)
    ): void;
    (
      key: string,
      exec: (runtime?: Partial<ActorSystemRuntime>) => void | (() => void)
    ): void;
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
  TInputSchema extends StandardSchemaV1 = StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1 = StandardSchemaV1
> {
  id?: string;
  schemas?: {
    input?: TInputSchema;
    output?: TOutputSchema;
  };
  context: TContext | ((args: { input: TInput }) => TContext);
  run: LogicFunction<TContext, TOutput, TEvent, TInput, TEmitted>;
}

interface LogicTransition<
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

function executeLogicEffect(
  self: AnyActorRef,
  key: string | undefined,
  effect: () => void | (() => void)
): void {
  const state = getEffectState(self);
  if (key !== undefined && state.has(key)) {
    return;
  }
  const cleanup = effect();
  state.set(key ?? Symbol(), {
    cleanup: typeof cleanup === 'function' ? cleanup : undefined
  });
}

function cleanupLogicEffects(self: AnyActorRef): void {
  const state = effectStates.get(self);
  if (!state) {
    return;
  }
  for (const { cleanup } of state.values()) {
    cleanup?.();
  }
  effectStates.delete(self);
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
  const TInputSchema extends StandardSchemaV1,
  const TOutputSchema extends StandardSchemaV1,
  TEvent extends EventObject = EventObject,
  TEmitted extends EventObject = EventObject
>(
  config: LogicConfig<
    TContext,
    StandardSchemaV1.InferOutput<TOutputSchema>,
    TEvent,
    StandardSchemaV1.InferOutput<TInputSchema>,
    TEmitted,
    TInputSchema,
    TOutputSchema
  > & {
    schemas: {
      input: TInputSchema;
      output: TOutputSchema;
    };
  }
): LogicActorLogic<
  TContext,
  StandardSchemaV1.InferOutput<TOutputSchema>,
  TEvent,
  StandardSchemaV1.InferOutput<TInputSchema>,
  TEmitted
>;
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
      output?: undefined;
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
  const TOutputSchema extends StandardSchemaV1,
  TEvent extends EventObject = EventObject,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  config: LogicConfig<
    TContext,
    StandardSchemaV1.InferOutput<TOutputSchema>,
    TEvent,
    TInput,
    TEmitted,
    StandardSchemaV1,
    TOutputSchema
  > & {
    schemas: {
      input?: undefined;
      output: TOutputSchema;
    };
  }
): LogicActorLogic<
  TContext,
  StandardSchemaV1.InferOutput<TOutputSchema>,
  TEvent,
  TInput,
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
        [
          createCustomEffect('xstate.logic.cleanup', () =>
            cleanupLogicEffects(actorScope.self)
          )
        ]
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
    const enqueueEffect = (
      key: string,
      exec: (runtime?: Partial<ActorSystemRuntime>) => void | (() => void)
    ) => {
      if (snapshot.effects?.[key]) {
        return;
      }
      effects.push(
        createCustomEffect(
          'xstate.logic.effect',
          (runtime = actorScope.self.system) =>
            executeLogicEffect(actorScope.self, key, () => exec(runtime)),
          { key }
        )
      );
      trackedEffects[key] = { status: 'active' };
    };
    const enq: LogicEnqueue<TEvent, TEmitted> = {
      emit: (emitted) => {
        effects.push(createEmitEffect(actorScope, emitted));
      },
      sendBack: (sentEvent) => {
        const parent = actorScope.self._parent;
        if (parent) {
          effects.push(createSendToEffect(actorScope, parent, sentEvent));
        }
      },
      raise: (raisedEvent) => {
        effects.push(
          createSendToEffect(actorScope, actorScope.self, raisedEvent)
        );
      },
      effect: ((keyOrExec, maybeExec) => {
        if (typeof keyOrExec === 'string') {
          enqueueEffect(keyOrExec, maybeExec);
          return;
        }
        const exec = keyOrExec as (
          runtime?: Partial<ActorSystemRuntime>
        ) => void | (() => void);
        effects.push(
          createCustomEffect(
            'xstate.logic.effect',
            (runtime = actorScope.self.system) =>
              executeLogicEffect(actorScope.self, undefined, () =>
                exec(runtime)
              )
          )
        );
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
    } as LogicSnapshot<TContext, TOutput, TInput>;

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

    return finalizeTransitionResult(actorScope, snapshot, [
      nextSnapshot,
      effects
    ]);
  }) as LogicTransition<TContext, TOutput, TEvent, TInput, TEmitted>;

  const logic: LogicActorLogic<TContext, TOutput, TEvent, TInput, TEmitted> = {
    id: config.id,
    config,
    transition,
    start: (snapshot, actorScope, options) => {
      if (!options?.restored) {
        return;
      }
      const [nextSnapshot, effects] = transition(
        snapshot,
        createInitEvent(snapshot.input) as unknown as TEvent,
        actorScope
      );
      Object.assign(snapshot, nextSnapshot);
      for (const effect of effects) {
        actorScope.actionExecutor(effect);
      }
    },
    initialTransition: (input, actorScope) => {
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

      return transition(
        { ...snapshot } as LogicSnapshot<TContext, TOutput, TInput>,
        createInitEvent(input) as unknown as TEvent,
        actorScope
      );
    },
    getInitialSnapshot: (actorScope, input) =>
      logic.initialTransition(input, actorScope)[0],
    getPersistedSnapshot: (snapshot) => snapshot,
    restoreSnapshot: (snapshot: any) => snapshot
  };

  return logic;
}
