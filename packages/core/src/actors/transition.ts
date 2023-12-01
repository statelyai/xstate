import {
  ActorLogic,
  ActorScope,
  ActorSystem,
  EventObject,
  ActorRefFrom,
  AnyActorSystem,
  Snapshot,
  NonReducibleUnknown
} from '../types';

export type TransitionSnapshot<TContext> = Snapshot<undefined> & {
  context: TContext;
};

export type TransitionActorLogic<
  TContext,
  TEvent extends EventObject,
  TInput extends NonReducibleUnknown
> = ActorLogic<TransitionSnapshot<TContext>, TEvent, TInput, AnyActorSystem>;

export type TransitionActorRef<
  TContext,
  TEvent extends EventObject
> = ActorRefFrom<
  TransitionActorLogic<TransitionSnapshot<TContext>, TEvent, unknown>
>;

/**
 * Returns actor logic given a transition function and its initial state.
 *
 * A “transition function” is a function that takes the current `state` and received `event` object as arguments, and returns the next state, similar to a reducer.
 *
 * Actors created from transition logic (“transition actors”) can:
 *
 * - Receive events
 * - Emit snapshots of its state
 *
 * The transition function’s `state` is used as its transition actor’s `context`.
 *
 * Note that the "state" for a transition function is provided by the initial state argument, and is not the same as the State object of an actor or a state within a machine configuration.
 *
 * @param transition The transition function used to describe the transition logic. It should return the next state given the current state and event. It receives the following arguments:
 * - `state` - the current state.
 * - `event` - the received event.
 * - `actorScope` - the actor scope object, with properties like `self` and `system`.
 * @param initialContext The initial state of the transition function, either an object representing the state, or a function which returns a state object. If a function, it will receive as its only argument an object with the following properties:
 * - `input` - the `input` provided to its parent transition actor.
 * - `self` - a reference to its parent transition actor.
 * @see {@link https://stately.ai/docs/input | Input docs} for more information about how input is passed
 * @returns Actor logic
 *
 * @example
 * ```ts
 * const transitionLogic = fromTransition(
 *   (state, event) => {
 *     if (event.type === 'increment') {
 *       return {
 *         ...state,
 *         count: state.count + 1,
 *       };
 *     }
 *     return state;
 *   },
 *   { count: 0 },
 * );
 *
 * const transitionActor = createActor(transitionLogic);
 * transitionActor.subscribe((snapshot) => {
 *   console.log(snapshot);
 * });
 * transitionActor.start();
 * // => {
 * //   status: 'active',
 * //   context: { count: 0 },
 * //   ...
 * // }
 *
 * transitionActor.send({ type: 'increment' });
 * // => {
 * //   status: 'active',
 * //   context: { count: 1 },
 * //   ...
 * // }
 * ```
 */
export function fromTransition<
  TContext,
  TEvent extends EventObject,
  TSystem extends ActorSystem<any>,
  TInput extends NonReducibleUnknown
>(
  transition: (
    snapshot: TContext,
    event: TEvent,
    actorScope: ActorScope<TransitionSnapshot<TContext>, TEvent, TSystem>
  ) => TContext,
  initialContext:
    | TContext
    | (({
        input,
        self
      }: {
        input: TInput;
        self: TransitionActorRef<TContext, TEvent>;
      }) => TContext) // TODO: type
): TransitionActorLogic<TContext, TEvent, TInput> {
  return {
    config: transition,
    transition: (snapshot, event, actorScope) => {
      return {
        ...snapshot,
        context: transition(
          snapshot.context,
          event as TEvent,
          actorScope as any
        )
      };
    },
    getInitialState: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        context:
          typeof initialContext === 'function'
            ? (initialContext as any)({ input })
            : initialContext
      };
    },
    getPersistedSnapshot: (snapshot) => snapshot,
    restoreSnapshot: (snapshot: any) => snapshot
  };
}
