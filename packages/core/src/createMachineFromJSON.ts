import { AnyStateMachine } from './types';

export interface ActionJSON {
  type: string;
  params?: Record<string, unknown>;
}

export interface GuardJSON {
  type: string;
  params?: Record<string, unknown>;
}

export interface InvokeJSON {
  id: string;
  src: string;
  input?: Record<string, unknown>;
  onDone?: string;
}

export interface TransitionJSON {
  target?: string | string[];
  actions?: ActionJSON[];
  guard?: GuardJSON;
  description?: string;
  reenter?: boolean;
}

export interface StateNodeJSON {
  id?: string;
  key: string;
  type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  initial: string;
  states: Record<string, StateNodeJSON>;
  on?: Record<string, TransitionJSON | TransitionJSON[]>;
  after?: Record<string, TransitionJSON | TransitionJSON[]>;
  always?: TransitionJSON | TransitionJSON[];
  invoke?: Record<string, InvokeJSON>;
  entry?: ActionJSON[];
  exit?: ActionJSON[];
}
export interface MachineJSON {
  id?: string;
  type: 'compound' | 'parallel';
  states?: Record<string, StateNodeJSON>;
  on?: Record<string, StateNodeJSON>;
  invoke?: Record<string, InvokeJSON>;
  entry?: ActionJSON[];
  exit?: ActionJSON[];
  after?: Record<string, TransitionJSON | TransitionJSON[]>;
  always?: TransitionJSON | TransitionJSON[];
  initial?: string;
}

function createMachineFromJSON(json: MachineJSON): AnyStateMachine {}
