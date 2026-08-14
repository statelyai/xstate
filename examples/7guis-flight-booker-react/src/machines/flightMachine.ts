import { setup, types, createAsyncLogic } from 'xstate';
import { createActorContext } from '@xstate/react';
import { TODAY, TOMORROW, sleep } from '../utils';

export const flightBookerMachine = setup({
  schemas: {
    context: types<FlightData>(),
    events: {
      BOOK_DEPART: types<{}>(),
      BOOK_RETURN: types<{}>(),
      CHANGE_TRIP_TYPE: types<{}>(),
      CHANGE_DEPART_DATE: types<{ value: string }>(),
      CHANGE_RETURN_DATE: types<{ value: string }>()
    }
  },
  actors: {
    booker: createAsyncLogic({
      run: () => sleep(2000)
    })
  },
  guards: {
    isValidDepartDate: ({ context }: { context: FlightData }) =>
      context.departDate >= TODAY,
    isValidReturnDate: ({ context }: { context: FlightData }) =>
      context.departDate >= TODAY && context.returnDate > context.departDate
  }
}).createMachine({
  id: 'flightBookerMachine',
  context: {
    departDate: TODAY,
    returnDate: TOMORROW
  },
  initial: 'scheduling',
  states: {
    scheduling: {
      initial: 'oneWay',
      on: {
        CHANGE_DEPART_DATE: ({ event }) => ({
          context: { departDate: event.value }
        })
      },
      states: {
        oneWay: {
          on: {
            CHANGE_TRIP_TYPE: { target: 'roundTrip' },
            BOOK_DEPART: ({ context, guards }) => {
              if (guards.isValidDepartDate({ context })) {
                return { target: '#flightBookerMachine.booking' };
              }
            }
          }
        },
        roundTrip: {
          on: {
            CHANGE_TRIP_TYPE: { target: 'oneWay' },
            CHANGE_RETURN_DATE: ({ event }) => ({
              context: { returnDate: event.value }
            }),
            BOOK_RETURN: ({ context, guards }) => {
              if (guards.isValidReturnDate({ context })) {
                return { target: '#flightBookerMachine.booking' };
              }
            }
          }
        }
      }
    },
    booking: {
      invoke: {
        src: 'booker',
        onDone: { target: 'booked' },
        onError: { target: 'scheduling' }
      }
    },
    booked: {
      type: 'final'
    }
  }
});

export default createActorContext(flightBookerMachine);
