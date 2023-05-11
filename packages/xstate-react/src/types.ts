import { EventObject, MachineContext, StateConfig } from 'xstate';

export type NoInfer<T> = [T][T extends any ? 0 : any];

export type Prop<T, K> = K extends keyof T ? T[K] : never;
export interface UseMachineOptions<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
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
