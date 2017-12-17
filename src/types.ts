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
  states?: Record<TStateKey, StateOrMachineConfig>;
  parallel?: boolean;
  key?: string;
  on?: Record<TEventType, Transition<TStateKey>>;
  onEntry?: Effect;
  onExit?: Effect;
  parent?: StateNode;
}

export interface StateLeafNodeConfig<
  TStateKey extends string = string,
  TEventType extends string = string
> extends StateNodeConfig<TStateKey, TEventType> {
  initial: never;
  parallel: never;
  states: never;
  parent: StateNode;
}

export interface BaseMachineConfig<
  TStateKey extends string = string,
  TEventType extends string = string
> extends StateNodeConfig<TStateKey, TEventType> {
  key?: string;
  initial?: string | undefined;
  parallel?: boolean;
  states: Record<TStateKey, StateOrMachineConfig>;
  on?: undefined;
  onEntry?: undefined;
  onExit?: undefined;
}

export interface MachineConfig<
  TStateKey extends string = string,
  TEventType extends string = string
> extends BaseMachineConfig<TStateKey, TEventType> {
  initial: string;
  parallel?: undefined;
}

export interface ParallelMachineConfig<
  TStateKey extends string = string,
  TEventType extends string = string
> extends BaseMachineConfig<TStateKey, TEventType> {
  initial?: undefined;
  parallel: true;
}

export type StateOrMachineConfig<
  TStateKey extends string = string,
  TEventType extends string = string
> =
  | StateLeafNodeConfig<TStateKey, TEventType>
  | MachineConfig<TStateKey, TEventType>
  | ParallelMachineConfig<TStateKey, TEventType>;

export type Effect = string | (<T>(extendedState: T) => T | void);
export interface EntryExitEffectMap {
  entry: Effect[];
  exit: Effect[];
}

export interface StateNode<
  TStateKey extends string = string,
  TEventType extends string = string
> {
  key: string;
  id: string;
  relativeId: string;
  initial: string | undefined;
  parallel: boolean;
  states: Record<TStateKey, StateNode>;
  on?: Record<TEventType, Transition<TStateKey>>;
  onEntry?: Effect;
  onExit?: Effect;
  parent: StateNode | undefined;
  machine: Machine;
}

export interface StateLeafNode<
  TStateKey extends string = string,
  TEventType extends string = string
> extends StateNode<TStateKey, TEventType> {
  initial: never;
  parallel: never;
  states: never;
  parent: StateNode;
}

export interface Machine extends StateNode {
  id: string;
  initial: string | undefined;
  parallel: boolean;
  states: Record<string, StateNode>;
  on: never;
  onEntry: never;
  onExit: never;
}

export interface StandardMachine extends Machine {
  initial: string;
  parallel: false;
}

export interface ParallelMachine extends Machine {
  initial: undefined;
  parallel: true;
}
