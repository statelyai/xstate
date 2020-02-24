import { createContext } from 'react';
import { State } from 'xstate';
import { tracker } from './tracker';

interface MachineContext {
  state: State<any, any>;
  // machine: StateMachine<any, any, any>;
  tracker: typeof tracker;
}

export const StateContext = createContext<MachineContext>(
  (null as any) as MachineContext
);
