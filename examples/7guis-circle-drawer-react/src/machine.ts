import { createActorContext } from "@xstate/react";
import { assertEvent, assign, fromCallback, setup } from "xstate";
import { getCircleById, getCircleUnderPointer } from "./utils";

export const DEFAULT_CIRCLE_RADIUS = 25;
export const DEFAULT_CIRCLE_COLOR = "#D27979";

export const machine = setup({
  types: {
    context: {} as {
      circles: Circles;
      undos: (Circles | undefined)[];
      redos: (Circles | undefined)[];
      selectedCircleId: string | undefined;
      boundaries: Position;
    },
    events: {} as
      | {
          type: "STAGE_TOUCHED";
          selectedCircle: Circle;
          currentPosition: Position;
        }
      | {
          type: "SELECT_CIRCLE";
          selectedCircle: Circle;
          params: { selectedCircle: Circle };
        }
      | {
          type: "ADD_CIRCLE";
          currentPosition: Position;
        }
      | {
          type: "DELETE_CIRCLE";
          id: string;
        }
      | {
          type: "START_EDIT";
        }
      | {
          type: "EDIT";
          setting: string;
          value: number | string;
        }
      | {
          type: "END_EDIT";
          setting: string;
          value: number | string;
        }
      | {
          type: "START_DRAG";
          position: Position;
        }
      | {
          type: "DRAG";
          position: Position;
        }
      | {
          type: "END_DRAG";
          position: Position;
          id: string;
        }
      | { type: "UNDO" }
      | { type: "REDO" },
  },
  guards: {
    "inBounds?": function ({ context, event }) {
      assertEvent(event, "END_DRAG");
      const circle = getCircleById(context.circles, context.selectedCircleId);
      if (!circle || !circle.radius) return false;
      return (
        event.position.x - circle.radius > 0 &&
        event.position.y - circle.radius > 0 &&
        event.position.x + circle.radius / 5 < context.boundaries.x &&
        event.position.y + circle.radius / 5 < context.boundaries.y
      );
    },
    "undosExist?": ({ context }) => context.undos.length > 0,
    "redosExist?": ({ context }) => context.redos.length > 0,
    "cursorUnderCircle?": ({ event }) => {
      assertEvent(event, "STAGE_TOUCHED");
      return !event.selectedCircle;
    },
  },
  actors: {
    Dragger: fromCallback(({ sendBack, input }) => {
      function onDrag(e: PointerEvent) {
        sendBack({
          type: "DRAG",
          position: { x: e.clientX, y: e.clientY },
        });
      }

      function onDragEnd(e: PointerEvent) {
        const circles = (input as { circles: Circle[] }).circles;
        const currentPosition = { x: e.clientX, y: e.clientY };

        const selectedCircle = getCircleUnderPointer(circles, currentPosition);

        sendBack({
          type: "END_DRAG",
          position: { x: e.clientX, y: e.clientY },
          id: selectedCircle?.id,
        });
      }

      window.addEventListener("pointermove", onDrag);
      window.addEventListener("pointerup", onDragEnd);

      return () => {
        window.removeEventListener("pointermove", onDrag);
        window.removeEventListener("pointerup", onDragEnd);
      };
    }),
  },
  actions: {
    handleAddCircle: assign(({ context, event }) => {
      assertEvent(event, "STAGE_TOUCHED");

      const circle = {
        id: crypto.randomUUID(),
        radius: DEFAULT_CIRCLE_RADIUS,
        color: DEFAULT_CIRCLE_COLOR,
        position: event.currentPosition,
      };

      return {
        selectedCircleId: circle.id,
        circles: [...context.circles, circle],
        undos: [...context.undos, context.circles],
        redos: [],
      };
    }),

    handleDeleteCircle: assign(({ context, event }) => {
      assertEvent(event, "END_DRAG");
      console.log("message");
      const circles = context.circles.filter(
        (circle) => circle?.id !== context.selectedCircleId
      );
      return { circles, redos: [] };
    }),

    handleSelectCircle: assign({
      selectedCircleId: (_, params: { selectedCircle: Circle }) => {
        return params.selectedCircle?.id as string;
      },
    }),

    handleEditStart: assign({
      undos: ({ context }) => [...context.undos, context.circles],
    }),

    handleEdit: assign(({ context, event }) => {
      assertEvent(event, "EDIT");
      const circle = getCircleById(context.circles, context.selectedCircleId);
      const circleCopy = { ...circle, [event.setting]: event.value };
      const index = context.circles.indexOf(circle);
      const circles = context.circles.toSpliced(index, 1, circleCopy);
      return { circles };
    }),

    handleDragStart: assign(({ context, event }) => {
      console.log("event.type", event.type);
      assertEvent(event, "START_DRAG");
      const circle = getCircleById(context.circles, context.selectedCircleId);
      const circleCopy = { ...circle, position: event.position };
      const index = context.circles.indexOf(circle);
      const circlesCopy = context.circles.toSpliced(index, 1, circleCopy);
      return {
        circles: circlesCopy,
        undos: [...context.undos, context.circles],
      };
    }),

    handleDrag: assign(({ context, event }) => {
      console.log("event.type", event.type);
      assertEvent(event, "DRAG");
      const circle = getCircleById(context.circles, context.selectedCircleId);
      const circleCopy = { ...circle, position: event.position };
      const circles = context.circles.slice();
      const index = context.circles.indexOf(circle);
      circles.splice(index, 1, circleCopy);
      return { circles };
    }),

    handleUndo: assign(({ context }) => {
      if (context.undos.length === 0) return context;
      return {
        circles: context.undos.pop(),
        undos: context.undos.slice(),
        redos: [...context.redos, context.circles.slice()],
      };
    }),

    handleRedo: assign(({ context }) => {
      if (context.redos.length === 0) return context;
      return {
        circles: context.redos.pop(),
        undos: [...context.undos, context.circles.slice()],
        redos: context.redos.slice(),
      };
    }),
  },
}).createMachine({
  context: {
    circles: [],
    undos: [],
    redos: [],
    boundaries: { x: window.innerWidth, y: window.innerHeight },
    selectedCircleId: undefined,
  },
  id: "circleDrawer",
  initial: "ready",
  states: {
    ready: {
      on: {
        START_EDIT: {
          target: "editing",
          actions: { type: "handleEditStart" },
        },
        START_DRAG: {
          target: "dragging",
          actions: "handleDragStart",
        },
        UNDO: {
          guard: "undosExist?",
          actions: {
            type: "handleUndo",
          },
        },
        REDO: {
          guard: "redosExist?",
          actions: {
            type: "handleRedo",
          },
        },
        STAGE_TOUCHED: [
          {
            target: "dragging",
            actions: {
              type: "handleAddCircle",
            },
            guard: {
              type: "cursorUnderCircle?",
            },
          },
          {
            target: "dragging",
            actions: {
              type: "handleSelectCircle",
              params: ({ context, event }) => {
                const selectedCircle = getCircleById(
                  context.circles,
                  event.selectedCircle?.id
                );
                return {
                  selectedCircle,
                };
              },
            },
          },
        ],
      },
    },
    editing: {
      on: {
        EDIT: {
          actions: {
            type: "handleEdit",
          },
        },
        END_EDIT: {
          target: "ready",
        },
      },
    },
    dragging: {
      invoke: {
        src: "Dragger",
        input: ({ context }) => {
          return {
            selectedCircleId: context.selectedCircleId,
            circles: context.circles,
          };
        },
      },
      on: {
        DRAG: {
          actions: {
            type: "handleDrag",
          },
        },
        END_DRAG: [
          {
            target: "ready",
            guard: {
              type: "inBounds?",
            },
          },
          {
            target: "ready",
            actions: {
              type: "handleDeleteCircle",
            },
          },
        ],
      },
    },
  },
});

export const CircleContext = createActorContext(machine);
