import { createMachine } from 'xstate';
export interface StateNodeTapEvent {
  type: 'stateNode.tap';
  stateNodeId: string;
}
export interface EventTapEvent {
  type: 'event.tap';
  stateNodeId: string;
  eventType: string;
  index: number;
}

export type MachineVizEvent = StateNodeTapEvent | EventTapEvent;

export const machineVizMachine = createMachine<undefined, MachineVizEvent>({
  initial: 'active',
  states: {
    active: {
      on: {
        'stateNode.tap': { actions: 'stateNodeTapped' },
        'event.tap': { actions: 'eventTapped' }
      }
    }
  }
});
