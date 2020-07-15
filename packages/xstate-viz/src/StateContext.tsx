import { createContext } from 'react';
import { State, Interpreter } from 'xstate';
import { Tracker } from './tracker';
import { MachineVizEvent } from './machineVizMachine';

interface MachineContext {
  state: State<any, any>;
  // machine: StateMachine<any, any, any>;
  tracker: Tracker;
  service: Interpreter<any, any, MachineVizEvent>;
}

export const StateContext = createContext<MachineContext>(
  (null as any) as MachineContext
);
