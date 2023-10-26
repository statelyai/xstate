import {
  ActorLogic,
  ActorContext,
  ActorSystem,
  EventObject,
  ActorRefFrom,
  AnyActorSystem,
  Snapshot
} from '../types';

export type TransitionSnapshot<TContext> = Snapshot<undefined> & {
  context: TContext;
};

export type TransitionActorLogic<
  TContext,
  TEvent extends EventObject,
  TInput
> = ActorLogic<TransitionSnapshot<TContext>, TEvent, TInput, AnyActorSystem>;

export type TransitionActorRef<
  TContext,
  TEvent extends EventObject
> = ActorRefFrom<
  TransitionActorLogic<TransitionSnapshot<TContext>, TEvent, unknown>
>;

/**
 * Returns actor logic from a transition function and its initial state.
 *
 * A transition function is a function that takes the current state and an event and returns the next state.
 *
 * @param transition The transition function that returns the next state given the current state and event.
 * @param initialContext The initial state of the transition function.
 * @returns Actor logic
 */
export function fromTransition<
  TContext,
  TEvent extends EventObject,
  TSystem extends ActorSystem<any>,
  TInput
>(
  transition: (
    state: TContext,
    event: TEvent,
    actorContext: ActorContext<TransitionSnapshot<TContext>, TEvent, TSystem>
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
    transition: (state, event, actorContext) => {
      return {
        ...state,
        context: transition(state.context, event as TEvent, actorContext as any)
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
    getPersistedState: (state) => state,
    restoreState: (state: any) => state
  };
}
