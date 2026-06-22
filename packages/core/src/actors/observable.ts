import { XSTATE_STOP } from '../constants';
import { StandardSchemaV1 } from '../schema.types.ts';
import { AnyActorSystem } from '../system.ts';
import {
  ActorLogic,
  ActorFromLogic,
  ActorRefFromLogic,
  AnyActor,
  EventObject,
  NonReducibleUnknown,
  Snapshot,
  Subscribable,
  Subscription
} from '../types';
import { createLogic as createBaseLogic } from './logic.ts';

const XSTATE_OBSERVABLE_NEXT = 'xstate.observable.next';
const XSTATE_OBSERVABLE_ERROR = 'xstate.observable.error';
const XSTATE_OBSERVABLE_COMPLETE = 'xstate.observable.complete';

export type ObservableSnapshot<
  TContext,
  TInput extends NonReducibleUnknown
> = Snapshot<undefined> & {
  context: TContext | undefined;
  input: TInput | undefined;
  effects?: Record<
    string,
    | { status: 'active' }
    | { status: 'done'; output?: unknown }
    | { status: 'error'; error: unknown }
  >;
  _subscription: Subscription | undefined;
};

export type ObservableActorLogic<
  TContext,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
> = ActorLogic<
  ObservableSnapshot<TContext, TInput>,
  { type: string; [k: string]: unknown },
  TInput,
  AnyActorSystem,
  TEmitted
>;

/**
 * Represents an actor created by `createObservableLogic` or
 * `createEventObservableLogic`.
 *
 * The type of `self` within the actor's logic.
 *
 * @example
 *
 * ```ts
 * import { createObservableLogic, createActor } from 'xstate';
 * import { interval } from 'rxjs';
 *
 * // The type of the value observed by the actor's logic.
 * type Context = number;
 * // The actor's input.
 * type Input = { period?: number };
 *
 * // Actor logic that observes a number incremented every `input.period`
 * // milliseconds (default: 1_000).
 * const logic = createObservableLogic<Context, Input>(
 *   ({ input, self }) => {
 *     self;
 *     // ^? ObservableActor<Event, Input>
 *
 *     return interval(input.period ?? 1_000);
 *   }
 * );
 *
 * const actor = createActor(logic, { input: { period: 2_000 } });
 * //    ^? ObservableActor<Event, Input>
 * ```
 *
 * @see {@link createObservableLogic}
 * @see {@link createEventObservableLogic}
 */
export type ObservableActorRef<TContext> = ActorRefFromLogic<
  ObservableActorLogic<TContext, any>
>;

type ObservableActor<
  TContext,
  TInput extends NonReducibleUnknown = any,
  TEmitted extends EventObject = EventObject
> = ActorFromLogic<ObservableActorLogic<TContext, TInput, TEmitted>>;

export type ObservableLogicFunction<
  TContext,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
> = ({
  input,
  system,
  self,
  emit
}: {
  input: TInput;
  system: AnyActorSystem;
  self: ObservableActor<TContext, TInput, TEmitted>;
  emit: (emitted: TEmitted) => void;
}) => Subscribable<TContext>;

export interface ObservableLogicConfig<
  TContext,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject,
  TInputSchema extends StandardSchemaV1 = StandardSchemaV1
> {
  schemas?: {
    input?: TInputSchema;
  };
  run: ObservableLogicFunction<TContext, TInput, TEmitted>;
}

export type EventObservableLogicFunction<
  TEvent extends EventObject,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
> = ({
  input,
  system,
  self,
  emit
}: {
  input: TInput;
  system: AnyActorSystem;
  self: ObservableActor<TEvent, TInput, TEmitted>;
  emit: (emitted: TEmitted) => void;
}) => Subscribable<TEvent>;

export interface EventObservableLogicConfig<
  TEvent extends EventObject,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject,
  TInputSchema extends StandardSchemaV1 = StandardSchemaV1
> {
  schemas?: {
    input?: TInputSchema;
  };
  run: EventObservableLogicFunction<TEvent, TInput, TEmitted>;
}

/**
 * Observable actor logic is described by an observable stream of values. Actors
 * created from observable logic (“observable actors”) can:
 *
 * - Emit snapshots of the observable’s emitted value
 *
 * The observable’s emitted value is used as its observable actor’s `context`.
 *
 * Sending events to observable actors will have no effect.
 *
 * @example
 *
 * ```ts
 * import { createObservableLogic, createActor } from 'xstate';
 * import { interval } from 'rxjs';
 *
 * const logic = createObservableLogic((obj) => interval(1000));
 *
 * const actor = createActor(logic);
 *
 * actor.subscribe((snapshot) => {
 *   console.log(snapshot.context);
 * });
 *
 * actor.start();
 * // At every second:
 * // Logs 0
 * // Logs 1
 * // Logs 2
 * // ...
 * ```
 *
 * @param observableCreator A function that creates an observable. It receives
 *   one argument, an object with the following properties:
 *
 *   - `input` - Data that was provided to the observable actor
 *   - `self` - The parent actor
 *   - `system` - The actor system to which the observable actor belongs
 *
 *   It should return a {@link Subscribable}, which is compatible with an RxJS
 *   Observable, although RxJS is not required to create them.
 * @see {@link https://rxjs.dev} for documentation on RxJS Observable and observable creators.
 * @see {@link Subscribable} interface in XState, which is based on and compatible with RxJS Observable.
 */
export function createObservableLogic<
  TContext,
  const TInputSchema extends StandardSchemaV1,
  TEmitted extends EventObject = EventObject
>(
  config: ObservableLogicConfig<
    TContext,
    StandardSchemaV1.InferOutput<TInputSchema>,
    TEmitted,
    TInputSchema
  > & {
    schemas: {
      input: TInputSchema;
    };
  }
): ObservableActorLogic<
  TContext,
  StandardSchemaV1.InferOutput<TInputSchema>,
  TEmitted
>;
export function createObservableLogic<
  TContext,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  config: ObservableLogicConfig<TContext, TInput, TEmitted> & {
    schemas?: undefined;
  }
): ObservableActorLogic<TContext, TInput, TEmitted>;
export function createObservableLogic<
  TContext,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  observableCreator: ObservableLogicFunction<TContext, TInput, TEmitted>
): ObservableActorLogic<TContext, TInput, TEmitted>;
export function createObservableLogic<
  TContext,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  observableCreatorOrConfig:
    | ObservableLogicFunction<TContext, TInput, TEmitted>
    | ObservableLogicConfig<TContext, TInput, TEmitted>
): ObservableActorLogic<TContext, TInput, TEmitted> {
  const observableCreator =
    typeof observableCreatorOrConfig === 'function'
      ? observableCreatorOrConfig
      : observableCreatorOrConfig.run;
  const schemas =
    typeof observableCreatorOrConfig === 'function'
      ? undefined
      : observableCreatorOrConfig.schemas;

  return createBaseLogic<
    TContext | undefined,
    undefined,
    { type: string; [k: string]: unknown },
    TInput,
    TEmitted
  >({
    schemas,
    context: undefined,
    run: (args, enq) => {
      const { event, input, self, system } = args;
      const emit = (args as any).emit as (emitted: TEmitted) => void;
      switch (event.type) {
        case XSTATE_OBSERVABLE_NEXT: {
          return {
            context: event.data as TContext
          };
        }
        case XSTATE_OBSERVABLE_ERROR:
          return {
            status: 'error',
            error: (event as any).data,
            input: undefined as TInput | undefined,
            effects: {
              observable: { status: 'error', error: (event as any).data }
            }
          };
        case XSTATE_OBSERVABLE_COMPLETE:
          return {
            status: 'done',
            input: undefined as TInput | undefined,
            effects: {
              observable: { status: 'done' }
            }
          };
      }

      enq.effect('observable', () => {
        const actorSelf = self as unknown as AnyActor;
        const subscription = observableCreator({
          input,
          system,
          self: self as any,
          emit: emit as (emitted: TEmitted) => void
        }).subscribe({
          next: (value) => {
            system._relay(actorSelf, actorSelf, {
              type: XSTATE_OBSERVABLE_NEXT,
              data: value
            });
          },
          error: (err) => {
            system._relay(actorSelf, actorSelf, {
              type: XSTATE_OBSERVABLE_ERROR,
              data: err
            });
          },
          complete: () => {
            system._relay(actorSelf, actorSelf, {
              type: XSTATE_OBSERVABLE_COMPLETE
            });
          }
        });

        return () => subscription.unsubscribe();
      });
    }
  }) as unknown as ObservableActorLogic<TContext, TInput, TEmitted>;
}

/**
 * Creates event observable logic that listens to an observable that delivers
 * event objects.
 *
 * Event observable actor logic is described by an observable stream of
 * {@link https://stately.ai/docs/transitions#event-objects | event objects}.
 * Actors created from event observable logic (“event observable actors”) can:
 *
 * - Implicitly send events to its parent actor
 * - Emit snapshots of its emitted event objects
 *
 * Sending events to event observable actors will have no effect.
 *
 * @example
 *
 * ```ts
 * import {
 *   createEventObservableLogic,
 *   Subscribable,
 *   EventObject,
 *   createMachine,
 *   createActor
 * } from 'xstate';
 * import { fromEvent } from 'rxjs';
 *
 * const mouseClickLogic = createEventObservableLogic(
 *   () => fromEvent(document.body, 'click') as Subscribable<EventObject>
 * );
 *
 * const canvasMachine = createMachine({
 *   invoke: {
 *     // Will send mouse `click` events to the canvas actor
 *     src: mouseClickLogic
 *   }
 * });
 *
 * const canvasActor = createActor(canvasMachine);
 * canvasActor.start();
 * ```
 *
 * @param lazyObservable A function that creates an observable that delivers
 *   event objects. It receives one argument, an object with the following
 *   properties:
 *
 *   - `input` - Data that was provided to the event observable actor
 *   - `self` - The parent actor
 *   - `system` - The actor system to which the event observable actor belongs.
 *
 *   It should return a {@link Subscribable}, which is compatible with an RxJS
 *   Observable, although RxJS is not required to create them.
 */
export function createEventObservableLogic<
  TEvent extends EventObject,
  const TInputSchema extends StandardSchemaV1,
  TEmitted extends EventObject = EventObject
>(
  config: EventObservableLogicConfig<
    TEvent,
    StandardSchemaV1.InferOutput<TInputSchema>,
    TEmitted,
    TInputSchema
  > & {
    schemas: {
      input: TInputSchema;
    };
  }
): ObservableActorLogic<
  TEvent,
  StandardSchemaV1.InferOutput<TInputSchema>,
  TEmitted
>;
export function createEventObservableLogic<
  TEvent extends EventObject,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  config: EventObservableLogicConfig<TEvent, TInput, TEmitted> & {
    schemas?: undefined;
  }
): ObservableActorLogic<TEvent, TInput, TEmitted>;
export function createEventObservableLogic<
  TEvent extends EventObject,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  lazyObservable: EventObservableLogicFunction<TEvent, TInput, TEmitted>
): ObservableActorLogic<TEvent, TInput, TEmitted>;
export function createEventObservableLogic<
  TEvent extends EventObject,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  lazyObservableOrConfig:
    | EventObservableLogicFunction<TEvent, TInput, TEmitted>
    | EventObservableLogicConfig<TEvent, TInput, TEmitted>
): ObservableActorLogic<TEvent, TInput, TEmitted> {
  const lazyObservable =
    typeof lazyObservableOrConfig === 'function'
      ? lazyObservableOrConfig
      : lazyObservableOrConfig.run;

  // TODO: event types
  const logic: ObservableActorLogic<TEvent, TInput, TEmitted> = {
    config: lazyObservable,
    transition: (state, event) => {
      if (state.status !== 'active') {
        return [state, []];
      }

      switch (event.type) {
        case XSTATE_OBSERVABLE_ERROR:
          return [
            {
              ...state,
              status: 'error',
              error: (event as any).data,
              input: undefined,
              _subscription: undefined
            },
            []
          ];
        case XSTATE_OBSERVABLE_COMPLETE:
          return [
            {
              ...state,
              status: 'done',
              input: undefined,
              _subscription: undefined
            },
            []
          ];
        case XSTATE_STOP:
          state._subscription!.unsubscribe();
          return [
            {
              ...state,
              status: 'stopped',
              input: undefined,
              _subscription: undefined
            },
            []
          ];
        default:
          return [state, []];
      }
    },
    initialTransition: (input, _) => [
      {
        status: 'active',
        output: undefined,
        error: undefined,
        context: undefined,
        input,
        _subscription: undefined
      },
      []
    ],
    getInitialSnapshot: (actorScope, input) =>
      logic.initialTransition(input, actorScope)[0],
    start: (state, { self, system, emit }) => {
      if (state.status === 'done') {
        // Do not restart a completed observable
        return;
      }

      state._subscription = lazyObservable({
        input: state.input!,
        system,
        self,
        emit
      }).subscribe({
        next: (value) => {
          if (self._parent) {
            system._relay(self, self._parent, value);
          }
        },
        error: (err) => {
          system._relay(self, self, {
            type: XSTATE_OBSERVABLE_ERROR,
            data: err
          });
        },
        complete: () => {
          system._relay(self, self, { type: XSTATE_OBSERVABLE_COMPLETE });
        }
      });
    },
    getPersistedSnapshot: ({ _subscription, ...snapshot }) => snapshot,
    restoreSnapshot: (snapshot: any) => ({
      ...snapshot,
      _subscription: undefined
    })
  };

  return logic;
}
