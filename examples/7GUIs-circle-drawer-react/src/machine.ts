import { createActorContext } from '@xstate/react';
import { assertEvent, assign, fromCallback, setup } from 'xstate';
import { getCircleById, getCircleUnderPointer } from './utils';

export const DEFAULT_CIRCLE_RADIUS = 25;
export const DEFAULT_CIRCLE_COLOR = '#D27979';

export const machine = setup({
  types: {
    context: {} as {
      circles: Circles;
      undos: (Circles | undefined)[];
      redos: (Circles | undefined)[];
      selectedCircleId: string | undefined;
      currentPosition: Position;
      boundaries: Position;
    },
    events: {} as
      | {
          type: 'STAGE_TOUCHED';
          circleUnderPointer: Circle;
          currentPosition: Position;
        }
      | { type: 'STAGE_RESIZE'; boundaries: Position }
      | {
          type: 'ADD_CIRCLE';
          currentPosition: Position;
        }
      | {
          type: 'START_EDIT';
        }
      | {
          type: 'EDIT';
          setting: string;
          value: number | string;
        }
      | {
          type: 'END_EDIT';
        }
      | {
          type: 'START_DRAG';
          position: Position;
          isSelected: boolean;
        }
      | {
          type: 'DRAG';
          position: Position;
        }
      | {
          type: 'END_DRAG';
          position: Position;
          id: string;
        }
      | { type: 'UNDO' }
      | { type: 'REDO' }
  },
  guards: {
    'inBounds?': function ({ context, event }) {
      assertEvent(event, 'END_DRAG');
      const circle = getCircleById(context.circles, context.selectedCircleId);
      if (!circle || !circle.radius) return false;
      return (
        event.position.y - 60 + circle.radius > 0 && // top
        event.position.x > 0 && // left
        event.position.y + 40 - circle.radius < context.boundaries.y && // bot
        event.position.x < context.boundaries.x // rt
      );
    },
    'undosExist?': ({ context }) => context.undos.length > 0,
    'redosExist?': ({ context }) => context.redos.length > 0,
    'circleUnderPointer?': ({ event }) => {
      assertEvent(event, 'STAGE_TOUCHED');
      return !event.circleUnderPointer;
    },
    'isSelected?': ({ event }) => {
      assertEvent(event, 'START_DRAG');
      return event.isSelected;
    }
  },
  actors: {
    Dragger: fromCallback(({ sendBack, input }) => {
      function onDrag(e: PointerEvent) {
        sendBack({
          type: 'DRAG',
          position: { x: e.clientX, y: e.clientY }
        });
      }

      function onDragEnd(e: PointerEvent) {
        const circles = (input as { circles: Circle[] }).circles;
        const currentPosition = { x: e.clientX, y: e.clientY };
        const currentCircle = getCircleUnderPointer(circles, currentPosition);
        sendBack({
          type: 'END_DRAG',
          position: { x: e.clientX, y: e.clientY },
          id: currentCircle?.id
        });
      }

      document.body.addEventListener('pointermove', onDrag);
      document.body.addEventListener('pointerup', onDragEnd);
      document.body.addEventListener('pointerleave', onDragEnd);
      return () => {
        document.body.removeEventListener('pointermove', onDrag);
        document.body.removeEventListener('pointerup', onDragEnd);
        document.body.removeEventListener('pointerleave', onDragEnd);
      };
    }),

    Sizer: fromCallback(({ sendBack }) => {
      function onResize() {
        sendBack({
          type: 'STAGE_RESIZE',
          boundaries: { x: window.innerWidth, y: window.innerHeight }
        });
      }
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
      };
    }),

    OrientationChanger: fromCallback(({ sendBack }) => {
      function onResize() {
        sendBack({
          type: 'STAGE_RESIZE',
          boundaries: { x: screen.width, y: screen.height }
        });
      }
      screen.orientation?.addEventListener('change', onResize);
      return () => {
        screen.orientation?.removeEventListener('change', onResize);
      };
    })
  },
  actions: {
    enforceBoundaries: assign(({ context, event }) => {
      assertEvent(event, 'STAGE_RESIZE');
      let undos = context.undos;
      context.circles.map((circle: Circle) => {
        if (!circle?.position || !circle.radius) return;

        if (circle?.position.x + circle.radius > event.boundaries.x) {
          circle.position.x = event.boundaries.x - circle.radius;
          undos = [];
        }

        if (circle?.position.y + circle.radius > event.boundaries.y) {
          circle.position.y = event.boundaries.y - circle.radius;
          undos = [];
        }
      });
      return {
        boundaries: event.boundaries,
        circles: context.circles,
        undos
      };
    }),
    handleAddCircle: assign(({ context, event }) => {
      assertEvent(event, 'STAGE_TOUCHED');

      const circle = {
        id: crypto.randomUUID(),
        radius: DEFAULT_CIRCLE_RADIUS,
        color: DEFAULT_CIRCLE_COLOR,
        position: event.currentPosition
      };

      return {
        selectedCircleId: circle.id,
        circles: [...context.circles, circle],
        undos: [...context.undos, context.circles],
        redos: []
      };
    }),

    handleDeleteCircle: assign(({ context }) => {
      const circles = context.circles.filter(
        (circle: Circle) => circle?.id !== context.selectedCircleId
      );
      return { circles, redos: [] };
    }),

    handleSelectCircle: assign(({ context, event }) => {
      assertEvent(event, 'STAGE_TOUCHED');
      const circle = event.circleUnderPointer;
      const circleCopy = { ...circle, position: event.currentPosition };
      const index = context.circles.indexOf(circle);
      const circles = context.circles.toSpliced(index, 1, circleCopy);
      return {
        selectedCircleId: event.circleUnderPointer?.id,
        circles,
        undos: [...context.undos, context.circles]
      };
    }),

    handleEditStart: assign({
      undos: ({ context }) => [...context.undos, context.circles]
    }),

    handleEdit: assign(({ context, event }) => {
      assertEvent(event, 'EDIT');
      const circle = getCircleById(context.circles, context.selectedCircleId);
      const circleCopy = { ...circle, [event.setting]: event.value };
      const index = context.circles.indexOf(circle);
      const circles = context.circles.toSpliced(index, 1, circleCopy);
      return { circles, redos: [] };
    }),

    handleDragStart: assign(({ context, event }) => {
      assertEvent(event, 'START_DRAG');
      const circle = getCircleById(context.circles, context.selectedCircleId);
      const isSamePosition = event.position.x === circle.position.x;
      const circleCopy = { ...circle, position: event.position };
      const index = context.circles.indexOf(circle);
      const circles = context.circles.toSpliced(index, 1, circleCopy);
      return {
        circles,
        undos: isSamePosition
          ? context.undos
          : [...context.undos, context.circles],
        redos: []
      };
    }),

    handleDrag: assign(({ context, event }) => {
      assertEvent(event, 'DRAG');
      const circle = getCircleById(context.circles, context.selectedCircleId);
      const circleCopy = { ...circle, position: event.position };
      const index = context.circles.indexOf(circle);
      const circles = context.circles.toSpliced(index, 1, circleCopy);
      return { circles };
    }),

    handleUndo: assign(({ context }) => {
      if (context.undos.length === 0) return context;
      return {
        circles: context.undos.pop(),
        redos: [...context.redos, context.circles]
      };
    }),

    handleRedo: assign(({ context }) => {
      if (context.redos.length === 0) return context;
      return {
        circles: context.redos.pop(),
        undos: [...context.undos, context.circles.slice()]
      };
    })
  }
}).createMachine({
  context: {
    circles: [],
    undos: [],
    redos: [],
    boundaries: { x: window.innerWidth, y: window.innerHeight },
    selectedCircleId: undefined,
    currentPosition: { x: 0, y: 0 }
  },
  id: 'circleDrawer',
  initial: 'ready',
  states: {
    ready: {
      invoke: [
        {
          src: 'Sizer',
          id: 'Sizer'
        },
        {
          src: 'OrientationChanger',
          id: 'OrientationChanger'
        }
      ],
      on: {
        START_EDIT: {
          target: 'editing',
          actions: { type: 'handleEditStart' }
        },
        UNDO: {
          guard: 'undosExist?',
          actions: {
            type: 'handleUndo'
          }
        },
        REDO: {
          guard: 'redosExist?',
          actions: {
            type: 'handleRedo'
          }
        },
        START_DRAG: {
          target: 'dragging',
          actions: {
            type: 'handleDragStart'
          },
          guard: 'isSelected?'
        },
        STAGE_TOUCHED: [
          {
            target: 'dragging',

            actions: {
              type: 'handleAddCircle'
            },

            guard: 'circleUnderPointer?'
          },
          {
            target: 'dragging',
            actions: {
              type: 'handleSelectCircle'
            }
          }
        ],
        STAGE_RESIZE: {
          actions: {
            type: 'enforceBoundaries'
          }
        }
      }
    },
    editing: {
      on: {
        EDIT: {
          actions: {
            type: 'handleEdit'
          }
        },
        END_EDIT: {
          target: 'ready'
        }
      }
    },
    dragging: {
      invoke: {
        src: 'Dragger',
        input: ({ context }) => {
          return {
            selectedCircleId: context.selectedCircleId,
            circles: context.circles
          };
        },
        id: 'Dragger'
      },
      on: {
        DRAG: {
          actions: {
            type: 'handleDrag'
          }
        },
        END_DRAG: [
          {
            target: 'ready',
            guard: {
              type: 'inBounds?'
            }
          },
          {
            target: 'ready',
            actions: {
              type: 'handleDeleteCircle'
            }
          }
        ]
      }
    }
  }
});

export const CircleContext = createActorContext(machine);
