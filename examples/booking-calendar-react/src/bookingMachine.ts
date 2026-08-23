import { createAsyncLogic, createCallbackLogic, setup, types } from 'xstate';
import { confirmBooking, fetchSlots, type Slot } from './api';

/** How long a slot stays held before it is released, in seconds. */
export const HOLD_SECONDS = 20;

export interface BookingContext {
  slots: Slot[];
  selectedId: string | null;
  /** Seconds remaining on the current hold, for the countdown display. */
  secondsLeft: number;
  confirmation: string | null;
  error: string | null;
}

export const bookingMachine = setup({
  schemas: {
    context: types<BookingContext>(),
    events: {
      select: types<{ slotId: string }>(),
      confirm: types<{}>(),
      release: types<{}>(),
      reset: types<{}>(),
      TICK: types<{}>()
    }
  },
  actors: {
    loadSlots: createAsyncLogic({
      run: () => fetchSlots()
    }),
    bookSlot: createAsyncLogic({
      schemas: { input: types<{ slotId: string }>() },
      run: ({ input }) => confirmBooking(input.slotId)
    }),
    seconds: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => sendBack({ type: 'TICK' }), 1000);
      return () => clearInterval(interval);
    })
  },
  guards: {
    isAvailable: ({ slots, slotId }: { slots: Slot[]; slotId: string }) =>
      slots.some((slot) => slot.id === slotId && !slot.taken)
  },
  delays: {
    holdTime: HOLD_SECONDS * 1000
  }
}).createMachine({
  id: 'booking',
  context: {
    slots: [],
    selectedId: null,
    secondsLeft: HOLD_SECONDS,
    confirmation: null,
    error: null
  },
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: 'loadSlots',
        onDone: ({ event }) => ({
          target: 'selecting',
          context: { slots: event.output }
        }),
        onError: () => ({
          target: 'selecting',
          context: { error: 'Could not load slots.' }
        })
      }
    },
    selecting: {
      on: {
        // Taken slots are not selectable: the guard returns false and the
        // transition function returns `undefined`, leaving the event unhandled.
        select: ({ context, event, guards }) =>
          guards.isAvailable({ slots: context.slots, slotId: event.slotId })
            ? {
                target: 'holding',
                context: {
                  selectedId: event.slotId,
                  secondsLeft: HOLD_SECONDS,
                  error: null
                }
              }
            : undefined
      }
    },
    /** The slot is reserved for the user, but only until the hold expires. */
    holding: {
      invoke: { src: 'seconds' },
      after: {
        holdTime: () => ({
          target: 'selecting',
          context: { selectedId: null, error: 'Your hold expired.' }
        })
      },
      on: {
        TICK: ({ context }) => ({
          context: { secondsLeft: context.secondsLeft - 1 }
        }),
        confirm: { target: 'confirming' },
        release: () => ({
          target: 'selecting',
          context: { selectedId: null }
        })
      }
    },
    confirming: {
      invoke: {
        src: 'bookSlot',
        input: ({ context }) => ({ slotId: context.selectedId! }),
        onDone: ({ event }) => ({
          target: 'booked',
          context: { confirmation: event.output }
        }),
        // Someone else took the slot first: mark it taken and go back to
        // selecting with the reason shown.
        onError: ({ context, event }) => ({
          target: 'selecting',
          context: {
            slots: context.slots.map((slot) =>
              slot.id === context.selectedId ? { ...slot, taken: true } : slot
            ),
            selectedId: null,
            error: (event.error as Error).message
          }
        })
      }
    },
    booked: {
      on: {
        reset: () => ({
          target: 'loading',
          context: {
            selectedId: null,
            confirmation: null,
            error: null,
            secondsLeft: HOLD_SECONDS
          }
        })
      }
    }
  }
});
