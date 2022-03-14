/* eslint-disable @typescript-eslint/ban-types */
export type StateFunction<TC = any, TA = any, R = any> = (
  context: TC,
  args: TA
) => R;

export type SingleOrArray<T> = T | T[];

export type TransitionDefinition<TC = any, TA = any> = {
  target: string;
  source: string;
  actions: StateFunction<TC, TA, void>[];
  conditions: StateFunction<TC, TA, boolean>[];
  description?: string;
};

export type StateType = 'sync' | 'async' | 'final' | 'unexpected';

export type BaseStateDefinition<
  TA = any,
  TC = any,
  T extends StateType = StateType
> = {
  value: string;
  matches: <T extends string>(value: T) => boolean;
  entry: StateFunction<TC, TA, void>[];
  exit: StateFunction<TC, TA, void>[];
  type: T;
};

export type SyncStateDefinition<TA = any, TC = any> = BaseStateDefinition<
  TA,
  TC,
  'sync'
> & {
  transitions: TransitionDefinition<TC, TA>[];
};

export type AsyncStateDefinition<TA = any, TC = any> = BaseStateDefinition<
  TC,
  TA,
  'async'
> & {
  promise: StateFunction<TC, TA, Promise<any>>;
  onDone: TransitionDefinition<TC, any>[];
  onError: TransitionDefinition<TC, any>[];
  timeout: number;
  finally?: (context?: TC) => void;
};

export type FinalStateDefinition<TC = any, TA = any> = BaseStateDefinition<
  TC,
  TA,
  'final'
>;

export type UnexpectedStateDefinition = {
  type: 'unexpected';
  value: string;
};

export type USD = UnexpectedStateDefinition;

export type StateDefinition<TA = any, TC = any> =
  | SyncStateDefinition<TA, TC>
  | AsyncStateDefinition<TA, TC>
  | FinalStateDefinition<TA, TC>
  | USD;

export type PromiseWithTimeoutArgs<T> = {
  timeoutMs: number;
  promise: () => Promise<T>;
  failureMessage?: string;
};

export type SAS = SingleOrArray<string>;

export type Transition = {
  target: string;
  conditions?: SAS;
  actions?: SAS;
  description?: string;
};

type _BaseState = {
  entry?: SAS;
  exit?: SAS;
  description?: string;
};

export type SyncState = _BaseState & {
  type: 'sync';
  transitions: SingleOrArray<Transition>;
};

export type AsyncState = _BaseState & {
  type: 'async';
  promise: string;
  onDone: Transition[];
  onError: Transition[];
  timeout: string;
};

export type FinalState = _BaseState & {
  type: 'final';
};

export type State = SyncState | AsyncState | FinalState;

export type DefinitionFromState<TA = any, TC = any, S extends State = State> =
  | (
      | ('sync' extends S['type'] ? SyncStateDefinition<TA, TC> : never)
      | ('async' extends S['type'] ? AsyncStateDefinition<TA, TC> : never)
      | ('final' extends S['type'] ? FinalStateDefinition<TA, TC> : never)
    )
  | USD;

export type DFS<
  TA = any,
  TC = any,
  S extends State = State
> = DefinitionFromState<TA, TC, S>;

export type Config<TA = any, TC = any, S extends State = State> = {
  context: TC;
  initial: string;
  args?: TA;
  tsTypes?: {
    context?: TC;
    args?: TA;
    // states?:
  };
  states: Record<string, S>;
};

export type Options<TC = any, TA = any> = {
  actions?: Record<string, StateFunction<TC, any, any>>;
  conditions?: Record<string, StateFunction<TC, TA, boolean>>;
  promises?: Record<string, StateFunction<TC, TA, Promise<any>>>;
  timeouts?: Record<string, number>;
  async?: true | undefined;
};
