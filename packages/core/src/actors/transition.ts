import {
  ActorLogic,
  ActorContext,
  ActorSystem,
  EventObject,
  ActorRefFrom,
  AnyActorSystem,
  ActorInternalState
} from '../types';

export type TransitionActorLogic<
  TSnapshot,
  TEvent extends EventObject,
  TInput
> = ActorLogic<
  TSnapshot,
  TEvent,
  TInput,
  unknown,
  ActorInternalState<TSnapshot, unknown>,
  TSnapshot,
  AnyActorSystem
>;

export type TransitionActorRef<
  TState,
  TEvent extends EventObject
> = ActorRefFrom<TransitionActorLogic<TState, TEvent, unknown>>;

/**
 * Returns actor logic from a transition function and its initial state.
 *
 * A transition function is a function that takes the current state and an event and returns the next state.
 *
 * @param transition The transition function that returns the next state given the current state and event.
 * @param initialSnapshot The initial state of the transition function.
 * @returns Actor logic
 */
export function fromTransition<
  TSnapshot,
  TEvent extends EventObject,
  TSystem extends ActorSystem<any>,
  TInput
>(
  transition: (
    state: TSnapshot,
    event: TEvent,
    actorContext: ActorContext<TEvent, TSnapshot, TSystem>
  ) => TSnapshot,
  initialSnapshot:
    | TSnapshot
    | (({
        input,
        self
      }: {
        input: TInput;
        self: TransitionActorRef<TSnapshot, TEvent>;
      }) => TSnapshot) // TODO: type
): TransitionActorLogic<TSnapshot, TEvent, TInput> {
  return {
    config: transition,
    transition: (state, event, actorContext) => {
      return {
        status: state.status,
        snapshot: transition(
          state.snapshot,
          event as TEvent,
          actorContext as any
        )
      };
    },
    getInitialState: (_, input) => {
      return {
        status: { status: 'active' },
        snapshot:
          typeof initialSnapshot === 'function'
            ? (initialSnapshot as any)({ input })
            : initialSnapshot
      };
    },
    getPersistedState: (state) => state.snapshot,
    restoreState: (snapshot) => {
      return {
        status: { status: 'active' },
        snapshot
      };
    }
  };
}
