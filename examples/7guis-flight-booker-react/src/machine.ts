import { setup, assign, assertEvent } from 'xstate';
import { createActorContext } from '@xstate/react';

const TODAY = new Date().toISOString().split('T')[0];

type FlightData = {
  startDate?: string;
  returnDate?: string;
};
export const flightBookerMachine = setup({
  types: {
    context: {} as FlightData,
    events: {} as
      | { type: 'BOOK' }
      | { type: 'CHANGE_TRIP' }
      | { type: 'CHANGE_START_DATE'; value: string }
      | { type: 'CHANGE_RETURN_DATE'; value: string }
  },
  actions: {
    setStartDate: assign(({ event }) => {
      assertEvent(event, 'CHANGE_START_DATE');
      return { startDate: event.value };
    }),
    setReturnDate: assign(({ event }) => {
      assertEvent(event, 'CHANGE_RETURN_DATE');
      return { returnDate: event.value };
    })
  },
  guards: {}
}).createMachine({
  context: {
    startDate: TODAY,
    returnDate: TODAY
  },
  id: 'flightBookerMachine',
  initial: 'booking',
  states: {
    booking: {
      initial: 'oneWay',
      on: {
        CHANGE_START_DATE: {
          actions: 'setStartDate'
        },
        BOOK: {
          target: 'booked'
        }
      },
      states: {
        oneWay: {
          on: {
            CHANGE_TRIP: {
              target: 'roundTrip'
            }
          }
        },
        roundTrip: {
          on: {
            CHANGE_TRIP: {
              target: 'oneWay'
            },
            CHANGE_RETURN_DATE: {
              actions: 'setReturnDate'
            }
          }
        }
      }
    },
    booked: {
      type: 'final'
    }
  }
});

export const FlightContext = createActorContext(flightBookerMachine);
