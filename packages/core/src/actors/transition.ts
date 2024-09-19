import { AnyActorSystem } from '../system.ts';
import {
  ActorLogic,
  ActorRefFromLogic,
  ActorScope,
  EventObject,
  NonReducibleUnknown,
  Snapshot
} from '../types.ts';

export type TransitionSnapshot<TContext> = Snapshot<undefined> & {
  context: TContext;
};

export type TransitionActorLogic<
  TContext,
  TEvent extends EventObject,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
> = ActorLogic<
  TransitionSnapshot<TContext>,
  TEvent,
  TInput,
  AnyActorSystem,
  TEmitted
>;

/**
 * Represents an actor created by `fromTransition`.
 *
 * The type of `self` within the actor's logic.
 *
 * @example
 *
 * ```ts
 * import {
 *   fromTransition,
 *   createActor,
 *   type AnyActorSystem
 * } from 'xstate';
 *
 * //* The actor's stored context.
 * type Context = {
 *   // The current count.
 *   count: number;
 *   // The amount to increase `count` by.
 *   step: number;
 * };
 * // The events the actor receives.
 * type Event = { type: 'increment' };
 * // The actor's input.
 * type Input = { step?: number };
 *
 * // Actor logic that increments `count` by `step` when it receives an event of
 * // type `increment`.
 * const logic = fromTransition<Context, Event, AnyActorSystem, Input>(
 *   (state, event, actorScope) => {
 *     actorScope.self;
 *     //         ^? TransitionActorRef<Context, Event>
 *
 *     if (event.type === 'increment') {
 *       return {
 *         ...state,
 *         count: state.count + state.step
 *       };
 *     }
 *     return state;
 *   },
 *   ({ input, self }) => {
 *     self;
 *     // ^? TransitionActorRef<Context, Event>
 *
 *     return {
 *       count: 0,
 *       step: input.step ?? 1
 *     };
 *   }
 * );
 *
 * const actor = createActor(logic, { input: { step: 10 } });
 * //    ^? TransitionActorRef<Context, Event>
 * ```
 *
 * @see {@link fromTransition}
 */
export type TransitionActorRef<
  TContext,
  TEvent extends EventObject
> = ActorRefFromLogic<
  TransitionActorLogic<TransitionSnapshot<TContext>, TEvent, unknown>
>;

/**
 * Returns actor logic given a transition function and its initial state.
 *
 * A “transition function” is a function that takes the current `state` and
 * received `event` object as arguments, and returns the next state, similar to
 * a reducer.
 *
 * Actors created from transition logic (“transition actors”) can:
 *
 * - Receive events
 * - Emit snapshots of its state
 *
 * The transition function’s `state` is used as its transition actor’s
 * `context`.
 *
 * Note that the "state" for a transition function is provided by the initial
 * state argument, and is not the same as the State object of an actor or a
 * state within a machine configuration.
 *
 * @example
 *
 * ```ts
 * const transitionLogic = fromTransition(
 *   (state, event) => {
 *     if (event.type === 'increment') {
 *       return {
 *         ...state,
 *         count: state.count + 1
 *       };
 *     }
 *     return state;
 *   },
 *   { count: 0 }
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
 *
 * @param transition The transition function used to describe the transition
 *   logic. It should return the next state given the current state and event.
 *   It receives the following arguments:
 *
 *   - `state` - the current state.
 *   - `event` - the received event.
 *   - `actorScope` - the actor scope object, with properties like `self` and
 *       `system`.
 *
 * @param initialContext The initial state of the transition function, either an
 *   object representing the state, or a function which returns a state object.
 *   If a function, it will receive as its only argument an object with the
 *   following properties:
 *
 *   - `input` - the `input` provided to its parent transition actor.
 *   - `self` - a reference to its parent transition actor.
 *
 * @returns Actor logic
 * @see {@link https://stately.ai/docs/input | Input docs} for more information about how input is passed
 */
export function fromTransition<
  TContext,
  TEvent extends EventObject,
  TSystem extends AnyActorSystem,
  TInput extends NonReducibleUnknown,
  TEmitted extends EventObject = EventObject
>(
  transition: (
    snapshot: TContext,
    event: TEvent,
    actorScope: ActorScope<
      TransitionSnapshot<TContext>,
      TEvent,
      TSystem,
      TEmitted
    >
  ) => TContext,
  initialContext:
    | TContext
    | (({
        input,
        self,
        spawnChild
      }: {
        input: TInput;
        self: TransitionActorRef<TContext, TEvent>;
        spawnChild: ActorScope<any, any, any>['spawnChild'];
      }) => TContext) // TODO: type
): TransitionActorLogic<TContext, TEvent, TInput, TEmitted> {
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
    getInitialSnapshot: ({ self, spawnChild }, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        context:
          typeof initialContext === 'function'
            ? (initialContext as any)({ input, self, spawnChild })
            : initialContext
      };
    },
    getPersistedSnapshot: (snapshot) => snapshot,
    restoreSnapshot: (snapshot: any) => snapshot
  };
}
