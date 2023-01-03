import { ActorContext, Behavior, EventObject } from '../types';

export function fromReducer<TState, TEvent extends EventObject>(
  reducer: (
    state: TState,
    event: TEvent,
    actorCtx?: ActorContext<Behavior<TEvent, TState, TState>>
  ) => TState,
  initialState: TState
): Behavior<TEvent, TState, TState> {
  return {
    transition: reducer,
    initialState,
    start: (state) => state,
    getSnapshot: (state) => state
  };
}

// How I would do it as a class:

export class ReducerBehavior<TState, TEvent extends EventObject>
  implements Behavior<TEvent, TState, TState> {
  constructor(
    private reducer: (
      state: TState,
      event: TEvent,
      actorCtx?: ActorContext<Behavior<TEvent, TState, TState>>
    ) => TState,
    public initialState: TState
  ) {}

  public transition(
    state: TState,
    event: TEvent,
    actorCtx?: ActorContext<this>
  ): TState {
    return this.reducer(state, event, actorCtx);
  }

  public getSnapshot(state: TState): TState {
    return state;
  }
}
