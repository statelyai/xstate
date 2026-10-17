import {
  XSTATE_LOGIC_EFFECT_REJECT,
  XSTATE_LOGIC_EFFECT_RESOLVE,
  XSTATE_LOGIC_EFFECT_START,
  XSTATE_INIT,
  XSTATE_STOP
} from '../constants.ts';
import { createInitEvent } from '../eventUtils.ts';
import { StandardSchemaV1 } from '../schema.types.ts';
import {
  ActorSystemRuntime,
  AnyActorSystem,
  type DeadLetterDetail
} from '../system.ts';
import { assertValid } from '../validation.ts';
import type { ActorLogicValidator } from '../validation.types.ts';
import {
  finalizeTransitionResult,
  createCustomEffect,
  createDeadLetterEffect,
  createEmitEffect,
  createSendToEffect
} from '../transitionActions.ts';
import {
  ActorLogic,
  ActorRefFrom,
  ActorScope,
  AnyActorRef,
  EventObject,
  ExecutableEffect,
  Snapshot
} from '../types.ts';
import type { NonReducibleUnknown } from '../typeUtils.ts';

/** @public */
export type StepSnapshot<TContext, TOutput, TInput> = Snapshot<TOutput> & {
  context: TContext;
  input: TInput | undefined;
  effects?: Record<string, StepEffectState>;
};

/** @public */
export type StepEffectState =
  | { status: 'active' }
  | { status: 'done'; output?: unknown }
  | { status: 'error'; error: unknown };

/** @public */
export interface StepLogicArgs<TContext, TEvent extends EventObject, TInput> {
  context: TContext;
  event: TEvent;
  input: TInput;
  system: AnyActorSystem;
  self: StepActorRef<TContext, unknown, TEvent, TInput>;
}

/** @public */
export interface StepLogicEnqueue<
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

/** @public */
export type StepPatch<TContext, TOutput, TInput> = Partial<{
  context: TContext;
  input: TInput | undefined;
  status: StepSnapshot<TContext, TOutput, TInput>['status'];
  output: TOutput;
  error: unknown;
  effects: Record<string, StepEffectState>;
}>;

/** @public */
export type StepLogicFunction<
  TContext,
  TOutput,
  TEvent extends EventObject,
  TInput,
  TEmitted extends EventObject
> = (
  args: StepLogicArgs<TContext, TEvent, TInput>,
  enq: StepLogicEnqueue<TEvent, TEmitted>
) => void | StepPatch<TContext, TOutput, TInput>;

/** @public */
export interface StepLogicConfig<
  TContext,
  TOutput,
  TEvent extends EventObject,
  TInput,
  TEmitted extends EventObject,
  TInputSchema extends StandardSchemaV1 = StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1 = StandardSchemaV1
> {
  id?: string;
  validator?: ActorLogicValidator;
  schemas?: {
    input?: TInputSchema;
    output?: TOutputSchema;
  };
  context: TContext | ((args: { input: TInput }) => TContext);
  run: StepLogicFunction<TContext, TOutput, TEvent, TInput, TEmitted>;
}

interface StepTransition<
  TContext,
  TOutput,
  TEvent extends EventObject,
  TInput,
  TEmitted extends EventObject
> {
  (
    snapshot: StepSnapshot<TContext, TOutput, TInput>,
    event: TEvent,
    actorScope: ActorScope<
      StepSnapshot<TContext, TOutput, TInput>,
      TEvent,
      AnyActorSystem,
      TEmitted
    >
  ): [StepSnapshot<TContext, TOutput, TInput>, ExecutableEffect[]];
  (
    snapshot: StepSnapshot<TContext, TOutput, TInput>,
    event: TEvent,
    actorScope: ActorScope<
      StepSnapshot<TContext, TOutput, TInput>,
      TEvent,
      AnyActorSystem,
      TEmitted
    >
  ): StepSnapshot<TContext, TOutput, TInput>;
}

/** @public */
export type StepActorLogic<
  TContext,
  TOutput,
  TEvent extends EventObject = EventObject,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
> = Omit<
  ActorLogic<
    StepSnapshot<TContext, TOutput, TInput>,
    TEvent,
    TInput,
    AnyActorSystem,
    TEmitted
  >,
  'transition'
> & {
  id?: string;
  transition: StepTransition<TContext, TOutput, TEvent, TInput, TEmitted>;
};

/** @public */
export type StepActorRef<
  TContext,
  TOutput,
  TEvent extends EventObject,
  TInput
> = ActorRefFrom<StepActorLogic<TContext, TOutput, TEvent, TInput>>;

const effectStates = new WeakMap<
  AnyActorRef,
  Map<PropertyKey, { cleanup?: () => void }>
>();

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
  effectStates.delete(self);
  let failure: { error: unknown } | undefined;
  for (const { cleanup } of state.values()) {
    try {
      cleanup?.();
    } catch (error) {
      failure ??= { error };
    }
  }
  if (failure) throw failure.error;
}

function resolveContext<TContext, TInput>(
  context: TContext | ((args: { input: TInput }) => TContext),
  input: TInput
) {
  return typeof context === 'function'
    ? (context as (args: { input: TInput }) => TContext)({ input })
    : context;
}

/** @public */
export function createStepLogic<
  TContext,
  const TInputSchema extends StandardSchemaV1,
  const TOutputSchema extends StandardSchemaV1,
  TEvent extends EventObject = EventObject,
  TEmitted extends EventObject = EventObject
>(
  config: StepLogicConfig<
    TContext,
    StandardSchemaV1.InferOutput<TOutputSchema>,
    TEvent,
    StandardSchemaV1.InferOutput<TInputSchema>,
    TEmitted,
    TInputSchema,
    TOutputSchema
  > & {
    schemas: { input: TInputSchema; output: TOutputSchema };
  }
): StepActorLogic<
  TContext,
  StandardSchemaV1.InferOutput<TOutputSchema>,
  TEvent,
  StandardSchemaV1.InferOutput<TInputSchema>,
  TEmitted
>;
export function createStepLogic<
  TContext,
  TOutput,
  const TInputSchema extends StandardSchemaV1,
  TEvent extends EventObject = EventObject,
  TEmitted extends EventObject = EventObject
>(
  config: StepLogicConfig<
    TContext,
    TOutput,
    TEvent,
    StandardSchemaV1.InferOutput<TInputSchema>,
    TEmitted,
    TInputSchema
  > & {
    schemas: { input: TInputSchema; output?: undefined };
  }
): StepActorLogic<
  TContext,
  TOutput,
  TEvent,
  StandardSchemaV1.InferOutput<TInputSchema>,
  TEmitted
>;
export function createStepLogic<
  TContext,
  const TOutputSchema extends StandardSchemaV1,
  TEvent extends EventObject = EventObject,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  config: StepLogicConfig<
    TContext,
    StandardSchemaV1.InferOutput<TOutputSchema>,
    TEvent,
    TInput,
    TEmitted,
    StandardSchemaV1,
    TOutputSchema
  > & {
    schemas: { input?: undefined; output: TOutputSchema };
  }
): StepActorLogic<
  TContext,
  StandardSchemaV1.InferOutput<TOutputSchema>,
  TEvent,
  TInput,
  TEmitted
>;
export function createStepLogic<
  TContext,
  TOutput = unknown,
  TEvent extends EventObject = EventObject,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  config: StepLogicConfig<TContext, TOutput, TEvent, TInput, TEmitted>
): StepActorLogic<TContext, TOutput, TEvent, TInput, TEmitted>;
export function createStepLogic<
  TContext,
  TOutput = unknown,
  TEvent extends EventObject = EventObject,
  TInput = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  config: StepLogicConfig<TContext, TOutput, TEvent, TInput, TEmitted>
): StepActorLogic<TContext, TOutput, TEvent, TInput, TEmitted> {
  const calculateTransition = ((snapshot, event, actorScope) => {
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
          createCustomEffect('@xstate.cleanup', () =>
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

    const effects: ExecutableEffect[] = [];
    const trackedEffects: Record<string, StepEffectState> = Object.create(null);
    const enqueueEffect = (
      key: string,
      exec: (runtime?: Partial<ActorSystemRuntime>) => void | (() => void)
    ) => {
      const recorded =
        snapshot.effects &&
        Object.prototype.hasOwnProperty.call(snapshot.effects, key)
          ? snapshot.effects[key]
          : undefined;
      // Active process-local attachments must be recreated on restore. A
      // completed effect remains memoized; ordinary events never reattach.
      if (
        recorded &&
        !(event.type === XSTATE_INIT && recorded.status === 'active')
      ) {
        return;
      }
      effects.push(
        createCustomEffect(
          '@xstate.effect',
          (runtime = actorScope.self.system) =>
            executeLogicEffect(actorScope.self, key, () => exec(runtime)),
          { key }
        )
      );
      trackedEffects[key] = { status: 'active' };
    };
    const enq: StepLogicEnqueue<TEvent, TEmitted> = {
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
            '@xstate.effect',
            (runtime = actorScope.self.system) =>
              executeLogicEffect(actorScope.self, undefined, () =>
                exec(runtime)
              )
          )
        );
      }) as StepLogicEnqueue<TEvent, TEmitted>['effect']
    };

    const patch = config.run(
      {
        context: snapshot.context,
        event,
        input: snapshot.input!,
        system: actorScope.system,
        self: actorScope.self as any,
        emit: actorScope.emit
      } as StepLogicArgs<TContext, TEvent, TInput>,
      enq
    );

    const nextSnapshot = {
      ...snapshot,
      ...(patch || {})
    } as StepSnapshot<TContext, TOutput, TInput>;

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
  }) as StepTransition<TContext, TOutput, TEvent, TInput, TEmitted>;

  const transition = ((snapshot, event, actorScope) => {
    if (config.validator) {
      const sourceRef = (actorScope.self as any)._lastSourceRef;
      const eventOrigin = sourceRef ? 'actor' : 'external';
      const error = config.validator.check({
        kind: 'event',
        logic,
        event,
        eventOrigin
      });
      if (error) {
        // Boundary fault: rejected (never delivered), not an actor error.
        return [
          snapshot,
          [
            createDeadLetterEffect(
              actorScope,
              sourceRef,
              event,
              'invalidEvent',
              {
                issues: (error as { issues?: DeadLetterDetail['issues'] })
                  .issues,
                error
              }
            )
          ]
        ];
      }
    }
    const result = calculateTransition(snapshot, event, actorScope);
    if (config.validator) {
      assertValid(config.validator, {
        kind: 'result',
        logic,
        snapshot: result[0],
        effects: result[1]
      });
    }
    return result;
  }) as StepTransition<TContext, TOutput, TEvent, TInput, TEmitted>;

  const logic: StepActorLogic<TContext, TOutput, TEvent, TInput, TEmitted> = {
    id: config.id,
    config,
    validator: config.validator,
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
      if (config.validator) {
        assertValid(config.validator, {
          kind: 'input',
          logic,
          input
        });
      }
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
        { ...snapshot } as StepSnapshot<TContext, TOutput, TInput>,
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
