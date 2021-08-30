import { EventObject, StateConfig } from 'xstate';

export type MaybeLazy<T> = T | (() => T);

export interface RehydrateOptions<TContext, TEvent extends EventObject> {
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;
}
