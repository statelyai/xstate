import { setup, types } from 'xstate';

export const DEFAULT_DIAMETER = 40;

export interface Circle {
  id: string;
  x: number;
  y: number;
  diameter: number;
}

interface CirclesContext {
  /** Undo stack: previous versions of the whole circle list. */
  past: Circle[][];
  /** The current model. */
  circles: Circle[];
  /** Redo stack. */
  future: Circle[][];
  selectedId: string | null;
  /** The list as it was when the adjuster opened, so a whole drag is one entry. */
  before: Circle[];
}

let nextId = 0;

/** Squared distance, enough to rank candidates without a square root. */
const distanceSq = (circle: Circle, x: number, y: number) =>
  (circle.x - x) ** 2 + (circle.y - y) ** 2;

/** The innermost circle containing the point, or `null`. */
export const circleAt = (circles: Circle[], x: number, y: number) =>
  circles
    .filter((circle) => distanceSq(circle, x, y) <= (circle.diameter / 2) ** 2)
    .sort((a, b) => distanceSq(a, x, y) - distanceSq(b, x, y))[0] ?? null;

export const circlesMachine = setup({
  schemas: {
    context: types<CirclesContext>(),
    events: {
      canvasClick: types<{ x: number; y: number }>(),
      openAdjuster: types<{ x: number; y: number }>(),
      resize: types<{ diameter: number }>(),
      commitResize: types<{}>(),
      undo: types<{}>(),
      redo: types<{}>()
    }
  },
  guards: {
    // Standalone, args-first: takes only the stack it inspects.
    canPop: (stack: Circle[][]) => stack.length > 0
  }
}).createMachine({
  id: 'circles',
  context: {
    past: [],
    circles: [],
    future: [],
    selectedId: null,
    before: []
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        // A click adds a circle, and that is one undo entry.
        canvasClick: ({ context, event }) => ({
          context: {
            past: context.past.concat([context.circles]),
            circles: context.circles.concat({
              id: `circle-${nextId++}`,
              x: event.x,
              y: event.y,
              diameter: DEFAULT_DIAMETER
            }),
            future: [],
            selectedId: null
          }
        }),
        // The secondary action opens the diameter adjuster for the circle
        // under the pointer, if there is one.
        openAdjuster: ({ context, event }) => {
          const circle = circleAt(context.circles, event.x, event.y);

          if (!circle) {
            return;
          }

          return {
            target: 'adjusting',
            // Snapshot the list so the whole drag collapses to one entry.
            context: { selectedId: circle.id, before: context.circles }
          };
        }
      }
    },
    // While the adjuster is open the model is edited in place and nothing is
    // pushed onto `past`. `commitResize` (fired when the slider is released)
    // records the pre-drag list as a single undo entry.
    adjusting: {
      on: {
        resize: ({ context, event }) => ({
          context: {
            circles: context.circles.map((circle) =>
              circle.id === context.selectedId
                ? { ...circle, diameter: event.diameter }
                : circle
            )
          }
        }),
        commitResize: ({ context }) => ({
          target: 'idle',
          context: {
            past:
              context.before === context.circles
                ? context.past
                : context.past.concat([context.before]),
            future: [],
            selectedId: null
          }
        })
      }
    }
  },
  on: {
    undo: ({ context, guards }) => {
      if (!guards.canPop(context.past)) {
        return;
      }

      return {
        target: '.idle',
        context: {
          past: context.past.slice(0, -1),
          circles: context.past[context.past.length - 1],
          future: [context.circles, ...context.future],
          selectedId: null
        }
      };
    },
    redo: ({ context, guards }) => {
      if (!guards.canPop(context.future)) {
        return;
      }

      return {
        target: '.idle',
        context: {
          past: context.past.concat([context.circles]),
          circles: context.future[0],
          future: context.future.slice(1),
          selectedId: null
        }
      };
    }
  }
});
