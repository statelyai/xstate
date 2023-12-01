import { XSTATE_STOP } from '../constants';
import {
  Subscribable,
  ActorLogic,
  EventObject,
  Subscription,
  AnyActorSystem,
  ActorRefFrom,
  Snapshot,
  NonReducibleUnknown
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
  TInput extends NonReducibleUnknown
> = ActorLogic<
  ObservableSnapshot<TContext, TInput>,
  { type: string; [k: string]: unknown },
  TInput,
  AnyActorSystem
>;

export type ObservableActorRef<TContext> = ActorRefFrom<
  ObservableActorLogic<TContext, any>
>;

/**
 * Observable actor logic is described by an observable stream of values. Actors created from observable logic (“observable actors”) can:
 *
 * - Emit snapshots of the observable’s emitted value
 *
 * The observable’s emitted value is used as its observable actor’s `context`.
 *
 * Sending events to observable actors will have no effect.
 *
 * @param observableCreator A function that creates an observable. It receives one argument, an object with the following properties:
 * - `input` - Data that was provided to the observable actor
 * - `self` - The parent actor
 * - `system` - The actor system to which the observable actor belongs
 *
 * It should return a {@link Subscribable}, which is compatible with an RxJS Observable, although RxJS is not required to create them.
 *
 * @example
 * ```ts
 * import { fromObservable, createActor } from 'xstate'
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
 * @see {@link https://rxjs.dev} for documentation on RxJS Observable and observable creators.
 * @see {@link Subscribable} interface in XState, which is based on and compatible with RxJS Observable.
 */
export function fromObservable<TContext, TInput extends NonReducibleUnknown>(
  observableCreator: ({
    input,
    system
  }: {
    input: TInput;
    system: AnyActorSystem;
    self: ObservableActorRef<TContext>;
  }) => Subscribable<TContext>
): ObservableActorLogic<TContext, TInput> {
  // TODO: add event types
  const logic: ObservableActorLogic<TContext, TInput> = {
    config: observableCreator,
    transition: (snapshot, event, { self, id, defer, system }) => {
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
    getInitialState: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        context: undefined,
        input,
        _subscription: undefined
      };
    },
    start: (state, { self, system }) => {
      if (state.status === 'done') {
        // Do not restart a completed observable
        return;
      }
      state._subscription = observableCreator({
        input: state.input!,
        system,
        self
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
 * Creates event observable logic that listens to an observable that delivers event objects.
 *
 * Event observable actor logic is described by an observable stream of {@link https://stately.ai/docs/transitions#event-objects | event objects}. Actors created from event observable logic (“event observable actors”) can:
 *
 * - Implicitly send events to its parent actor
 * - Emit snapshots of its emitted event objects
 *
 * Sending events to event observable actors will have no effect.
 *
 * @param lazyObservable A function that creates an observable that delivers event objects. It receives one argument, an object with the following properties:
 *
 * - `input` - Data that was provided to the event observable actor
 * - `self` - The parent actor
 * - `system` - The actor system to which the event observable actor belongs.
 *
 * It should return a {@link Subscribable}, which is compatible with an RxJS Observable, although RxJS is not required to create them.
 *
 * @example
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
 * const mouseClickLogic = fromEventObservable(() =>
 *   fromEvent(document.body, 'click') as Subscribable<EventObject>
 * );
 *
 * const canvasMachine = createMachine({
 *   invoke: {
 *     // Will send mouse `click` events to the canvas actor
 *     src: mouseClickLogic,
 *   }
 * });
 *
 * const canvasActor = createActor(canvasMachine);
 * canvasActor.start();
 * ```
 */
export function fromEventObservable<
  T extends EventObject,
  TInput extends NonReducibleUnknown
>(
  lazyObservable: ({
    input,
    system
  }: {
    input: TInput;
    system: AnyActorSystem;
    self: ObservableActorRef<T>;
  }) => Subscribable<T>
): ObservableActorLogic<T, TInput> {
  // TODO: event types
  const logic: ObservableActorLogic<T, TInput> = {
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
    getInitialState: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        context: undefined,
        input,
        _subscription: undefined
      };
    },
    start: (state, { self, system }) => {
      if (state.status === 'done') {
        // Do not restart a completed observable
        return;
      }

      state._subscription = lazyObservable({
        input: state.input!,
        system,
        self
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
