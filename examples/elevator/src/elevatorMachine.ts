import { setup, types } from 'xstate';

export interface ElevatorContext {
  /** The floor the car is currently at. */
  currentFloor: number;
  /** Floors that have been called, served in the order they arrived. */
  queue: number[];
}

export const TOP_FLOOR = 6;
export const BOTTOM_FLOOR = 1;

/** Which way the car is heading, derived from the queue. */
export const directionOf = (context: ElevatorContext): -1 | 0 | 1 => {
  const [next] = context.queue;
  if (next === undefined) return 0;
  return Math.sign(next - context.currentFloor) as -1 | 0 | 1;
};

/**
 * Accepts a call unless it is redundant: the car is already at that floor, or
 * the floor is already queued. Returning `undefined` leaves the event
 * unhandled, which is how a transition is guarded in XState v6.
 */
const enqueueCall = ({
  context,
  event
}: {
  context: ElevatorContext;
  event: { floor: number };
}) =>
  event.floor === context.currentFloor || context.queue.includes(event.floor)
    ? undefined
    : { context: { queue: [...context.queue, event.floor] } };

export const elevatorMachine = setup({
  schemas: {
    context: types<ElevatorContext>(),
    events: {
      call: types<{ floor: number }>(),
      closeDoors: types<{}>()
    }
  },
  delays: {
    /** Time to travel one floor. */
    travelTime: 900,
    /** How long the doors stay open before closing on their own. */
    doorsCloseDelay: 3000
  }
}).createMachine({
  id: 'elevator',
  context: {
    currentFloor: BOTTOM_FLOOR,
    queue: []
  },
  states: {
    doorsClosed: {
      // With no queued floors the car waits here; `always` sends it on its way
      // as soon as a call comes in.
      always: ({ context }) =>
        context.queue.length > 0 ? { target: 'moving' } : undefined,
      on: {
        call: ({ context, event }) =>
          event.floor === context.currentFloor
            ? { target: 'doorsOpen' }
            : enqueueCall({ context, event })
      }
    },
    moving: {
      after: {
        // One tick per floor. Arriving at the head of the queue opens the
        // doors and drops that floor; otherwise the car keeps going, and
        // re-entering `moving` restarts the timer.
        travelTime: ({ context }) => {
          const destination = context.queue[0]!;
          const nextFloor = context.currentFloor + directionOf(context);

          return nextFloor === destination
            ? {
                target: 'doorsOpen',
                context: {
                  currentFloor: nextFloor,
                  queue: context.queue.slice(1)
                }
              }
            : {
                target: 'moving',
                // Re-enter this state so the travel timer starts again.
                reenter: true,
                context: { currentFloor: nextFloor }
              };
        }
      },
      on: {
        call: enqueueCall
      }
    },
    doorsOpen: {
      after: {
        doorsCloseDelay: { target: 'doorsClosed' }
      },
      on: {
        closeDoors: { target: 'doorsClosed' },
        call: enqueueCall
      }
    }
  },
  initial: 'doorsClosed'
});
