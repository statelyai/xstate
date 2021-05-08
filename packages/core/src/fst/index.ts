// https://en.wikipedia.org/wiki/Finite-state_transducer

import type { State, StateMachine } from '..';

export { fromActor } from './actor';
export { fromMachine } from './machine';
export { fromReducer } from './reducer';

export type FSTTransition<TState, TInput, TOutput> = (
  state: TState,
  input: TInput
) => [TState] | [TState, TOutput];

export interface FST<TState, TInput, TOutput = any> {
  transition: FSTTransition<TState, TInput, TOutput>;
  initialState: TState;
  nextEvents?: (state: TState) => TInput[];
}

export type FSTFrom<T> = T extends StateMachine<
  infer TContext,
  any,
  infer TEvent
>
  ? FST<State<TContext, TEvent>, TEvent, any[]>
  : never;
