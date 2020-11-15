// https://en.wikipedia.org/wiki/Finite-state_transducer

import { State, StateMachine } from '.';

export type FSTTransition<TState, TInput, TOutput> = (
  state: TState,
  input: TInput
) => [TState, TOutput];

export interface FST<TState, TInput, TOutput = any> {
  transition: FSTTransition<TState, TInput, TOutput>;
  initialState: TState;
  events: TInput[];
  nextEvents?: (state: TState) => TInput[];
}

export type FSTFrom<
  TMachine extends StateMachine<any, any, any>
> = TMachine extends StateMachine<infer TContext, any, infer TEvent>
  ? FST<State<TContext, TEvent>, TEvent, any[]>
  : never;

export function machineToFST<TMachine extends StateMachine<any, any, any>>(
  machine: TMachine,
  nextEvents?: FSTFrom<TMachine>['nextEvents']
): FSTFrom<TMachine> {
  return {
    transition: ((state, input) => {
      const nextState = machine.transition(state, input);
      return [nextState, []];
    }) as FSTFrom<TMachine>['transition'],
    initialState: machine.initialState,
    events: [] as FSTFrom<TMachine>['events'],
    nextEvents
  } as FSTFrom<TMachine>;
}
