import { EventObject, StateConfig } from 'xstate';

export type Prop<T, K> = K extends keyof T ? T[K] : never;

export type MaybeLazy<T> = T | (() => T);
export interface UseMachineOptions<TContext, TEvent extends EventObject> {
  /**
   * If provided, will be merged with machine's `context`.
   */
  context?: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;
}
