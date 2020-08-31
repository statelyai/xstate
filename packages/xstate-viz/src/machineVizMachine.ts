import { assign, createMachine, EventObject } from "xstate";
export interface StateNodeTapEvent {
  type: "stateNode.tap";
  stateNodeId: string;
}
export interface EventTapEvent {
  type: "event.tap";
  stateNodeId: string;
  eventType: string;
  trackingId: string;
  index: number;
}

export interface CanvasTapEvent {
  type: "canvas.tap";
}

export interface EventCommitEvent extends Omit<EventTapEvent, "type"> {
  type: "event.commit";
  data: EventObject;
}

export type MachineVizEvent =
  | StateNodeTapEvent
  | EventTapEvent
  | CanvasTapEvent
  | EventCommitEvent;

export interface MachineVizContext {
  popover?: EventTapEvent;
}

export const machineVizMachine = createMachine<
  MachineVizContext,
  MachineVizEvent
>({
  initial: "active",
  context: {},
  states: {
    active: {
      on: {},
    },
  },
  on: {
    "canvas.tap": {
      actions: [assign({ popover: undefined }), "canvasTapped"],
    },
    "stateNode.tap": {
      actions: [assign({ popover: undefined }), "stateNodeTapped"],
    },
    "event.tap": {
      actions: ["eventTapped"],
    },
  },
});
