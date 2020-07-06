import { createContext } from 'react';
import { State } from 'xstate';
import { Tracker } from './tracker';

interface MachineContext {
  state: State<any, any>;
  // machine: StateMachine<any, any, any>;
  tracker: Tracker;
}

export const StateContext = createContext<MachineContext>(
  (null as any) as MachineContext
);
