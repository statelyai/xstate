import { types, createMachine, createAsyncLogic } from 'xstate';
import { createActorContext } from '@xstate/react';
import { TODAY, TOMORROW, sleep } from '../utils';
export const flightBookerMachine = createMachine({
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
    Booker: createAsyncLogic({
      run: () => {
        return sleep(2000);
      }
    })
  },
  id: 'flightBookerMachine',
  context: {
    isRoundTrip: false,
    departDate: TODAY,
    returnDate: TOMORROW
  },
  initial: 'scheduling',
  states: {
    scheduling: {
      initial: 'oneWay',
      on: {
        CHANGE_DEPART_DATE: ({ context, event }) => ({
          context: { ...context, departDate: event.value }
        })
      },
      states: {
        oneWay: {
          on: {
            CHANGE_TRIP_TYPE: ({ context }) => ({
              target: 'roundTrip',
              context: { ...context, isRoundTrip: true }
            }),
            BOOK_DEPART: ({ context }) => {
              if (!(context.departDate >= TODAY)) {
                return;
              }
              return { target: '#flightBookerMachine.booking' };
            }
          }
        },
        roundTrip: {
          on: {
            CHANGE_TRIP_TYPE: ({ context }) => ({
              target: 'oneWay',
              context: { ...context, isRoundTrip: false }
            }),
            CHANGE_RETURN_DATE: ({ context, event }) => ({
              context: { ...context, returnDate: event.value }
            }),
            BOOK_RETURN: ({ context }) => {
              if (
                !(
                  context.departDate >= TODAY &&
                  context.returnDate > context.departDate
                )
              ) {
                return;
              }
              return { target: '#flightBookerMachine.booking' };
            }
          }
        }
      }
    },
    booking: {
      invoke: {
        src: 'Booker',
        onDone: {
          target: 'booked'
        },
        onError: ({ context }) => ({
          target: context.isRoundTrip
            ? 'scheduling.roundTrip'
            : 'scheduling.oneWay'
        })
      }
    },
    booked: {
      type: 'final'
    }
  }
});
export default createActorContext(flightBookerMachine);
