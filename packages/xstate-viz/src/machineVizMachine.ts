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

export interface CanvasTapEvent {
  type: 'canvas.tap';
}

export type MachineVizEvent =
  | StateNodeTapEvent
  | EventTapEvent
  | CanvasTapEvent;

export const machineVizMachine = createMachine<undefined, MachineVizEvent>({
  initial: 'active',
  states: {
    active: {
      on: {
        'stateNode.tap': { actions: 'stateNodeTapped' },
        'event.tap': { actions: 'eventTapped' },
        'canvas.tap': { actions: 'canvasTapped' }
      }
    }
  }
});
