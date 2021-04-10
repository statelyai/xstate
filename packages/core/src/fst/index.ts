// https://en.wikipedia.org/wiki/Finite-state_transducer

import type { State, StateMachine } from '..';

export * from './actor';
export * from './machine';
export * from './reducer';

export type FSTTransition<TState, TInput, TOutput> = (
  state: TState,
  input: TInput
) => [TState] | [TState, TOutput];

export interface FST<TState, TInput, TOutput = any> {
  transition: FSTTransition<TState, TInput, TOutput>;
  initialState: TState;
  events: TInput[];
  nextEvents?: (state: TState) => TInput[];
}

export type FSTFrom<T> = T extends StateMachine<
  infer TContext,
  any,
  infer TEvent
>
  ? FST<State<TContext, TEvent>, TEvent, any[]>
  : never;
