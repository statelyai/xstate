import { Cause, Context, Effect, Exit, Fiber, Scope } from 'effect';
import {
  createActor,
  createLogic,
  type Actor,
  type ActorLogic,
  type ActorOptions,
  type AnyActor,
  type AnyActorLogic,
  type AnyActorSystem,
  type ErrorFrom,
  type EventObject,
  type LogicSnapshot,
  type OutputFrom,
  type RequiredActorOptionsKeys,
  type StateMachine
} from 'xstate';

const EFFECT_RESOLVE = '@xstate.effect.resolve';
const EFFECT_REJECT = '@xstate.effect.reject';

declare const effectActorChannels: unique symbol;

interface EffectActorChannels<A, E, R, I> {
  readonly [effectActorChannels]: {
    readonly output: A;
    readonly error: E;
    readonly requirements: R;
    readonly input: I;
  };
}

export class EffectActorDefect extends Error {
  public override readonly cause: Cause.Cause<unknown>;

  constructor(cause: Cause.Cause<unknown>) {
    super('An Effect actor died with a defect.', { cause });
    this.name = 'EffectActorDefect';
    this.cause = cause;
  }
}

export class EffectActorInterrupted extends Error {
  public override readonly cause: Cause.Cause<unknown>;

  constructor(cause: Cause.Cause<unknown>) {
    super('An Effect actor was interrupted outside its XState lifecycle.', {
      cause
    });
    this.name = 'EffectActorInterrupted';
    this.cause = cause;
  }
}

export type EffectActorError<E> =
  | E
  | EffectActorDefect
  | EffectActorInterrupted;

type EffectActorEvent<A, E> =
  | { type: typeof EFFECT_RESOLVE; output: A }
  | { type: typeof EFFECT_REJECT; error: EffectActorError<E> }
  | EventObject;

export interface EffectActorArgs<I> {
  input: I;
  self: AnyActor;
  system: AnyActorSystem;
}

export type EffectActorSnapshot<A, E, I> = LogicSnapshot<undefined, A, I> & {
  error: EffectActorError<E> | undefined;
};

export type EffectActorLogic<A, E, R, I> = ActorLogic<
  EffectActorSnapshot<A, E, I>,
  EffectActorEvent<A, E>,
  I,
  AnyActorSystem,
  EventObject,
  EffectActorError<E>
> &
  EffectActorChannels<A, E, R, I> & { id?: string };

export interface FromEffectConfig<A, E, R, I> {
  id?: string;
  effect: (args: EffectActorArgs<I>) => Effect.Effect<A, E, R>;
}

interface EffectRuntimeState {
  context: Context.Context<any>;
  fibers: Set<Fiber.Fiber<any, any>>;
}

const effectRuntimeStates = new WeakMap<AnyActorSystem, EffectRuntimeState>();

function toActorError<E>(cause: Cause.Cause<E>): EffectActorError<E> {
  if (Cause.hasDies(cause)) {
    return new EffectActorDefect(cause);
  }
  if (Cause.hasInterrupts(cause)) {
    return new EffectActorInterrupted(cause);
  }
  return Cause.squash(cause) as E;
}

function startEffect<A, E, R, I>(
  self: AnyActor,
  input: I,
  effect: FromEffectConfig<A, E, R, I>['effect']
): () => void {
  const runtimeState = effectRuntimeStates.get(self.system);
  if (!runtimeState) {
    throw new Error(
      'Effect actor logic must be started with spawnActor() or runActor() from @xstate/effect.'
    );
  }

  let cancelling = false;
  const fiber = Effect.runForkWith(runtimeState.context as Context.Context<R>)(
    effect({ input, self, system: self.system })
  );
  runtimeState.fibers.add(fiber);

  fiber.addObserver((exit) => {
    runtimeState.fibers.delete(fiber);
    if (cancelling) {
      return;
    }

    if (Exit.isSuccess(exit)) {
      void self.system.sendEvent(self, self, {
        type: EFFECT_RESOLVE,
        output: exit.value
      });
      return;
    }

    void self.system.sendEvent(self, self, {
      type: EFFECT_REJECT,
      error: toActorError(exit.cause)
    });
  });

  return () => {
    if (cancelling || fiber.pollUnsafe()) {
      return;
    }
    cancelling = true;
    fiber.interruptUnsafe();
  };
}

export function fromEffect<A, E, R, I = void>(
  effect: (args: EffectActorArgs<I>) => Effect.Effect<A, E, R>
): EffectActorLogic<A, E, R, I>;
export function fromEffect<A, E, R, I = void>(
  config: FromEffectConfig<A, E, R, I>
): EffectActorLogic<A, E, R, I>;
export function fromEffect<A, E, R, I = void>(
  effectOrConfig:
    | FromEffectConfig<A, E, R, I>
    | ((args: EffectActorArgs<I>) => Effect.Effect<A, E, R>)
): EffectActorLogic<A, E, R, I> {
  const config =
    typeof effectOrConfig === 'function'
      ? { effect: effectOrConfig }
      : effectOrConfig;

  return createLogic<undefined, A, EffectActorEvent<A, E>, I, EventObject>({
    id: config.id,
    context: undefined,
    run: ({ event, input, self }, enq) => {
      if (event.type === EFFECT_RESOLVE) {
        return {
          status: 'done',
          output: (event as { output: A }).output,
          input: undefined
        };
      }
      if (event.type === EFFECT_REJECT) {
        return {
          status: 'error',
          error: (event as { error: EffectActorError<E> }).error,
          input: undefined
        };
      }
      if (event.type !== '@xstate.init') {
        return;
      }

      enq.effect(() =>
        startEffect(self as unknown as AnyActor, input, config.effect)
      );
    }
  }) as unknown as EffectActorLogic<A, E, R, I>;
}

export type RequirementsFrom<TLogic> =
  TLogic extends EffectActorChannels<any, any, infer R, any>
    ? R
    : TLogic extends StateMachine<
          any,
          any,
          any,
          any,
          any,
          any,
          any,
          any,
          any,
          any,
          any,
          infer TActorMap,
          any,
          any
        >
      ? RequirementsFrom<TActorMap[keyof TActorMap]>
      : never;

export type CheckedErrorFrom<TLogic> =
  TLogic extends EffectActorChannels<any, infer E, any, any>
    ? E
    : ErrorFrom<TLogic>;

type ActorOptionsArgs<TLogic extends AnyActorLogic> =
  RequiredActorOptionsKeys<TLogic> extends never
    ? [options?: ActorOptions<TLogic>]
    : [options: ActorOptions<TLogic>];

function shutdownActor<TLogic extends AnyActorLogic>(
  actor: Actor<TLogic>
): Effect.Effect<void> {
  return Effect.suspend(() => {
    const runtimeState = effectRuntimeStates.get(actor.system);
    const fibers = runtimeState ? [...runtimeState.fibers] : [];
    actor.stop();

    return Fiber.interruptAll(fibers).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          effectRuntimeStates.delete(actor.system);
        })
      )
    );
  });
}

function acquireActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: ActorOptions<TLogic> | undefined,
  context: Context.Context<RequirementsFrom<TLogic>>,
  start: boolean
): Effect.Effect<Actor<TLogic>, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const actor = createActor(logic, options as any);
      effectRuntimeStates.set(actor.system, {
        context,
        fibers: new Set()
      });
      if (start) {
        // A scoped actor can fail synchronously before its caller receives the
        // ref. Keep that failure in its snapshot instead of reporting it as an
        // unhandled host error.
        actor.subscribe({ error: () => {} });
        try {
          actor.start();
        } catch (error) {
          effectRuntimeStates.delete(actor.system);
          throw error;
        }
      }
      return actor;
    }),
    shutdownActor
  );
}

export function spawnActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ActorOptionsArgs<TLogic>
): Effect.Effect<Actor<TLogic>, never, RequirementsFrom<TLogic> | Scope.Scope> {
  return Effect.context<RequirementsFrom<TLogic>>().pipe(
    Effect.flatMap((context) => acquireActor(logic, options, context, true))
  );
}

function waitForActor<TLogic extends AnyActorLogic>(
  actor: Actor<TLogic>,
  start = false
): Effect.Effect<OutputFrom<TLogic>, CheckedErrorFrom<TLogic>> {
  return Effect.callback((resume) => {
    let settled = false;
    let subscription: { unsubscribe(): void } | undefined;

    const succeed = (output: OutputFrom<TLogic>) => {
      if (settled) return;
      settled = true;
      subscription?.unsubscribe();
      resume(Effect.succeed(output));
    };
    const fail = (error: ErrorFrom<TLogic>) => {
      if (settled) return;
      settled = true;
      subscription?.unsubscribe();
      if (
        error instanceof EffectActorDefect ||
        error instanceof EffectActorInterrupted
      ) {
        resume(
          Effect.failCause(error.cause as Cause.Cause<CheckedErrorFrom<TLogic>>)
        );
      } else {
        resume(Effect.fail(error as CheckedErrorFrom<TLogic>));
      }
    };
    const inspectSnapshot = (snapshot: any) => {
      if (snapshot.status === 'done') {
        succeed(snapshot.output as OutputFrom<TLogic>);
      } else if (snapshot.status === 'error') {
        fail(snapshot.error as ErrorFrom<TLogic>);
      }
    };

    inspectSnapshot(actor.getSnapshot());
    if (!settled) {
      subscription = actor.subscribe({
        next: inspectSnapshot,
        error: (error: unknown) => fail(error as ErrorFrom<TLogic>)
      } as any);
      if (start) {
        actor.start();
      }
    }

    return Effect.sync(() => subscription?.unsubscribe());
  });
}

export function runActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ActorOptionsArgs<TLogic>
): Effect.Effect<
  OutputFrom<TLogic>,
  CheckedErrorFrom<TLogic>,
  RequirementsFrom<TLogic>
> {
  return Effect.scoped(
    Effect.context<RequirementsFrom<TLogic>>().pipe(
      Effect.flatMap((context) =>
        acquireActor(logic, options, context, false).pipe(
          Effect.flatMap((actor) => waitForActor(actor, true))
        )
      )
    )
  );
}
