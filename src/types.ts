import { StateNode } from './index';
import State from './State';

export declare type EventType = string | number;

export declare interface EventObject {
  type: EventType;
  [key: string]: any;
}

export declare type Event = EventType | EventObject;
export type StateKey = string | State;

export interface StateValueMap {
  [key: string]: StateValue;
}

export type StateValue = string | StateValueMap;

export type Condition = (extendedState: any) => boolean;

export interface TransitionConfig {
  cond?: (extendedState: any, event: EventObject) => boolean;
  actions?: string[];
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
  on?: Record<TEventType, Transition<TStateKey> | undefined>;
  onEntry?: Action;
  onExit?: Action;
  parent?: StateNode;
  strict?: boolean;
}

export interface StateLeafNodeConfig<
  TStateKey extends string = string,
  TEventType extends string = string
> extends StateNodeConfig<TStateKey, TEventType> {
  initial?: undefined;
  parallel?: undefined;
  states?: undefined;
}

export interface BaseMachineConfig<
  TStateKey extends string = string,
  TEventType extends string = string
> extends StateNodeConfig<TStateKey, TEventType> {
  key?: string;
  initial?: string | undefined;
  parallel?: boolean;
  states: Record<TStateKey, StateOrMachineConfig>;
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
  | MachineConfig<TStateKey, TEventType>
  | ParallelMachineConfig<TStateKey, TEventType>
  | StateLeafNodeConfig<TStateKey, TEventType>;

export type Action =
  | string
  | (<T>(extendedState: T, event?: Partial<Event>, ...other: any[]) => T | any);
export interface EntryExitEffectMap {
  entry: Action[];
  exit: Action[];
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
  onEntry?: Action;
  onExit?: Action;
  parent: StateNode | undefined;
  machine: Machine;
}

export interface ComplexStateNode<
  TStateKey extends string = string,
  TEventType extends string = string
> extends StateNode<TStateKey, TEventType> {
  initial: string;
}

export interface LeafStateNode<
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
