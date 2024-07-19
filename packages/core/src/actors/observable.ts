import { XSTATE_STOP } from '../constants';
import { AnyActorSystem } from '../system.ts';
import {
  ActorLogic,
  ActorRefFrom,
  ActorScope,
  EventObject,
  NonReducibleUnknown,
  Snapshot,
  Subscribable,
  Subscription
} from '../types';

const XSTATE_OBSERVABLE_NEXT = 'xstate.observable.next';
const XSTATE_OBSERVABLE_ERROR = 'xstate.observable.error';
const XSTATE_OBSERVABLE_COMPLETE = 'xstate.observable.complete';

export type ObservableSnapshot<
  TContext,
  TInput extends NonReducibleUnknown
> = Snapshot<undefined> & {
  context: TContext | undefined;
  input: TInput | undefined;
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
 * Represents an actor created by `fromObservable` or `fromEventObservable`.
 *
 * The type of `self` within the actor's logic.
 *
 * @example
 *
 * ```ts
 * import { fromObservable, createActor } from 'xstate';
 * import { interval } from 'rxjs';
 *
 * // The type of the value observed by the actor's logic.
 * type Context = number;
 * // The actor's input.
 * type Input = { period?: number };
 *
 * // Actor logic that observes a number incremented every `input.period`
 * // milliseconds (default: 1_000).
 * const logic = fromObservable<Context, Input>(({ input, self }) => {
 *   self;
 *   // ^? ObservableActorRef<Event, Input>
 *
 *   return interval(input.period ?? 1_000);
 * });
 *
 * const actor = createActor(logic, { input: { period: 2_000 } });
 * //    ^? ObservableActorRef<Event, Input>
 * ```
 *
 * @see {@link fromObservable}
 * @see {@link fromEventObservable}
 */
export type ObservableActorRef<TContext> = ActorRefFrom<
  ObservableActorLogic<TContext, any>
>;

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
 * import { fromObservable, createActor } from 'xstate';
 * import { interval } from 'rxjs';
 *
 * const logic = fromObservable((obj) => interval(1000));
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
export function fromObservable<
  TContext,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  observableCreator: ({
    input,
    system,
    self
  }: {
    input: TInput;
    system: AnyActorSystem;
    self: ObservableActorRef<TContext>;
    spawnChild: ActorScope<any, any>['spawnChild'];
    emit: (emitted: TEmitted) => void;
  }) => Subscribable<TContext>
): ObservableActorLogic<TContext, TInput, TEmitted> {
  // TODO: add event types
  const logic: ObservableActorLogic<TContext, TInput, TEmitted> = {
    config: observableCreator,
    transition: (snapshot, event) => {
      if (snapshot.status !== 'active') {
        return snapshot;
      }

      switch (event.type) {
        case XSTATE_OBSERVABLE_NEXT: {
          const newSnapshot = {
            ...snapshot,
            context: event.data as TContext
          };
          return newSnapshot;
        }
        case XSTATE_OBSERVABLE_ERROR:
          return {
            ...snapshot,
            status: 'error',
            error: (event as any).data,
            input: undefined,
            _subscription: undefined
          };
        case XSTATE_OBSERVABLE_COMPLETE:
          return {
            ...snapshot,
            status: 'done',
            input: undefined,
            _subscription: undefined
          };
        case XSTATE_STOP:
          snapshot._subscription!.unsubscribe();
          return {
            ...snapshot,
            status: 'stopped',
            input: undefined,
            _subscription: undefined
          };
        default:
          return snapshot;
      }
    },
    getInitialSnapshot: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        context: undefined,
        input,
        _subscription: undefined
      };
    },
    start: (state, { self, system, spawnChild, emit }) => {
      if (state.status === 'done') {
        // Do not restart a completed observable
        return;
      }
      state._subscription = observableCreator({
        input: state.input!,
        system,
        self,
        spawnChild,
        emit
      }).subscribe({
        next: (value) => {
          system._relay(self, self, {
            type: XSTATE_OBSERVABLE_NEXT,
            data: value
          });
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
    getPersistedSnapshot: ({ _subscription, ...state }) => state,
    restoreSnapshot: (state) => ({
      ...(state as any),
      _subscription: undefined
    })
  };

  return logic;
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
 *   fromEventObservable,
 *   Subscribable,
 *   EventObject,
 *   createMachine,
 *   createActor
 * } from 'xstate';
 * import { fromEvent } from 'rxjs';
 *
 * const mouseClickLogic = fromEventObservable(
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
export function fromEventObservable<
  TEvent extends EventObject,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  lazyObservable: ({
    input,
    system,
    self,
    emit
  }: {
    input: TInput;
    system: AnyActorSystem;
    self: ObservableActorRef<TEvent>;
    emit: (emitted: TEmitted) => void;
  }) => Subscribable<TEvent>
): ObservableActorLogic<TEvent, TInput, TEmitted> {
  // TODO: event types
  const logic: ObservableActorLogic<TEvent, TInput, TEmitted> = {
    config: lazyObservable,
    transition: (state, event) => {
      if (state.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case XSTATE_OBSERVABLE_ERROR:
          return {
            ...state,
            status: 'error',
            error: (event as any).data,
            input: undefined,
            _subscription: undefined
          };
        case XSTATE_OBSERVABLE_COMPLETE:
          return {
            ...state,
            status: 'done',
            input: undefined,
            _subscription: undefined
          };
        case XSTATE_STOP:
          state._subscription!.unsubscribe();
          return {
            ...state,
            status: 'stopped',
            input: undefined,
            _subscription: undefined
          };
        default:
          return state;
      }
    },
    getInitialSnapshot: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        context: undefined,
        input,
        _subscription: undefined
      };
    },
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
