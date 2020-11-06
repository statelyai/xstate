// https://en.wikipedia.org/wiki/Finite-state_transducer

export interface FST<TState, TInput> {
  transition: (state: TState, input: TInput) => TState;
  initialState: TState;
}
