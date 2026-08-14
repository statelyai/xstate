import { setup, types } from 'xstate';

const DRAG_THRESHOLD = 5;

const reorder = (items: string[], from: number, to: number) => {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

export const dragMachine = setup({
  schemas: {
    context: types<{
      items: string[];
      /** Index of the item under the pointer, or -1 when nothing is pressed */
      sourceIndex: number;
      targetIndex: number;
      originY: number;
      offsetY: number;
    }>(),
    events: {
      POINTER_DOWN: types<{ index: number; y: number }>(),
      POINTER_MOVE: types<{ y: number }>(),
      POINTER_OVER: types<{ index: number }>(),
      POINTER_UP: types<{}>(),
      CANCEL: types<{}>()
    }
  }
}).createMachine({
  id: 'drag',
  initial: 'idle',
  context: {
    items: ['Read the docs', 'Write a machine', 'Ship it', 'Take a break'],
    sourceIndex: -1,
    targetIndex: -1,
    originY: 0,
    offsetY: 0
  },
  states: {
    idle: {
      on: {
        POINTER_DOWN: ({ context, event }) => ({
          target: 'pressed',
          context: {
            ...context,
            sourceIndex: event.index,
            targetIndex: event.index,
            originY: event.y,
            offsetY: 0
          }
        })
      }
    },
    pressed: {
      on: {
        // A press only becomes a drag once the pointer moves far enough
        POINTER_MOVE: ({ context, event }) => {
          const offsetY = event.y - context.originY;

          if (Math.abs(offsetY) < DRAG_THRESHOLD) {
            return;
          }

          return { target: 'dragging', context: { ...context, offsetY } };
        },
        POINTER_UP: { target: 'idle' },
        CANCEL: { target: 'cancelled' }
      }
    },
    dragging: {
      on: {
        POINTER_MOVE: ({ context, event }) => ({
          context: { ...context, offsetY: event.y - context.originY }
        }),
        POINTER_OVER: ({ context, event }) => ({
          context: { ...context, targetIndex: event.index }
        }),
        POINTER_UP: { target: 'dropped' },
        CANCEL: { target: 'cancelled' }
      }
    },
    dropped: {
      // Dropping commits the reorder, then settles back to idle
      always: ({ context }) => ({
        target: 'idle',
        context: {
          ...context,
          items: reorder(
            context.items,
            context.sourceIndex,
            context.targetIndex
          ),
          sourceIndex: -1,
          targetIndex: -1,
          offsetY: 0
        }
      })
    },
    cancelled: {
      // Cancelling returns to idle without reordering anything
      always: ({ context }) => ({
        target: 'idle',
        context: {
          ...context,
          sourceIndex: -1,
          targetIndex: -1,
          offsetY: 0
        }
      })
    }
  }
});
