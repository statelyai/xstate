import { State, StateNode } from './index';

export type Action =
  | number
  | string
  | {
      type: string;
      [key: string]: any;
    };

export type StateKey = string | State;

export interface IStateValueMap {
  [key: string]: StateValue;
}
export type StateValue = string | IStateValueMap;

export interface IStateNodeConfig {
  initial?: string;
  states?: Record<string, IStateNodeConfig>;
  parallel?: boolean;
  key?: string;
  on?: Record<string, string>;
  parent?: StateNode;
}

export interface IHistory {
  $current: StateValue;
  [key: string]: IHistory | StateValue; // TODO: remove StateValue
}
