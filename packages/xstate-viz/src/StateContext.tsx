import { createContext } from "react";
import { State, Interpreter, StateNode } from "xstate";
import { Tracker } from "./tracker";
import { MachineVizContext, MachineVizEvent } from "./machineVizMachine";

interface MachineContext {
  state?: State<any, any> | undefined;
  // machine: StateMachine<any, any, any>;
  tracker: Tracker;
  service: Interpreter<MachineVizContext, any, MachineVizEvent>;
  selection: StateNode[];
}

export const StateContext = createContext<MachineContext>(
  (null as any) as MachineContext
);
