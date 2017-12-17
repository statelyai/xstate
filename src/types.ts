import { StateNode } from './index';
import State from './State';

export type EventType = string | number;

export type Event =
  | EventType
  | {
      type: EventType;
      [key: string]: any;
    };

export type StateKey = string | State;

export interface StateValueMap {
  [key: string]: StateValue;
}

export type StateValue = string | StateValueMap;

export type Condition = (extendedState: any) => boolean;

export interface TransitionConfig {
  cond: (extendedState: any, event: Event) => boolean;
  onTransition?: (extendedState: any, event: Event) => void;
}

export type Transition<TStateKey extends string = string> =
  | TStateKey
  | Record<TStateKey, TransitionConfig>;

export interface StateNodeConfig<
  TStateKey extends string = string,
  TEventType extends string = string
> {
  initial?: string;
  states?: Record<TStateKey, StateNodeConfig>;
  parallel?: boolean;
  key?: string;
  on?: Record<TEventType, Transition<TStateKey>>;
  onEntry?: Effect;
  onExit?: Effect;
  parent?: StateNode;
}

export type Effect = string | (<T>(extendedState: T) => T | void);
export interface EntryExitEffectMap {
  entry: Effect[];
  exit: Effect[];
}
