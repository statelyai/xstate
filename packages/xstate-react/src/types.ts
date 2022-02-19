import {
  ActionMeta,
  EventObject,
  MachineContext,
  State,
  StateConfig,
  BaseActionObject
} from 'xstate';

export type MaybeLazy<T> = T | (() => T);

export type NoInfer<T> = [T][T extends any ? 0 : any];

export type Prop<T, K> = K extends keyof T ? T[K] : never;

export enum ReactEffectType {
  Effect = 1,
  LayoutEffect = 2
}

export type ReactActionFunction<
  TContext extends MachineContext,
  TEvent extends EventObject
> = (
  context: TContext,
  event: TEvent,
  meta: ActionMeta<TContext, TEvent>
) => () => void;

export interface ReactActionObject<
  TContext extends MachineContext,
  TEvent extends EventObject
> extends BaseActionObject {
  params: {
    __effect: ReactEffectType;
    exec: ReactActionFunction<TContext, TEvent>;
  };
}

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

export type ActionStateTuple<
  TContext extends MachineContext,
  TEvent extends EventObject
> = [ReactActionObject<TContext, TEvent>, State<TContext, TEvent>];
