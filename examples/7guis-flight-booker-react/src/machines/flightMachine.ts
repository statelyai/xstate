import { createMachine, assertEvent, createAsyncLogic } from 'xstate';
import { createActorContext } from '@xstate/react';
import { TODAY, TOMORROW, sleep } from '../utils';
export const flightBookerMachine = createMachine({
  types: {
    context: {} as FlightData,
    events: {} as
      | {
          type: 'BOOK_DEPART';
        }
      | {
          type: 'BOOK_RETURN';
        }
      | {
          type: 'CHANGE_TRIP_TYPE';
        }
      | {
          type: 'CHANGE_DEPART_DATE';
          value: string;
        }
      | {
          type: 'CHANGE_RETURN_DATE';
          value: string;
        }
  },
  actions: {
    setDepartDate: ({ context, event }) => {
      assertEvent(event, 'CHANGE_DEPART_DATE');
      return { context: { ...context, departDate: event.value } };
    },
    setReturnDate: ({ context, event }) => {
      assertEvent(event, 'CHANGE_RETURN_DATE');
      return { context: { ...context, returnDate: event.value } };
    }
  },
  actorSources: {
    Booker: createAsyncLogic({
      run: () => {
        return sleep(2000);
      }
    })
  },
  guards: {
    'isValidDepartDate?': ({ context: { departDate } }) => {
      return departDate >= TODAY;
    },
    'isValidReturnDate?': ({ context: { departDate, returnDate } }) => {
      return departDate >= TODAY && returnDate > departDate;
    }
  },
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
        CHANGE_DEPART_DATE: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['setDepartDate'](actionArgs as any));
        }
      },
      states: {
        oneWay: {
          on: {
            CHANGE_TRIP_TYPE: {
              target: 'roundTrip'
            },
            BOOK_DEPART: ({ context, event, guards, actions }, enq) => {
              if (!guards['isValidDepartDate?']({ context, event })) {
                return;
              }
              return { target: '#flightBookerMachine.booking' };
            }
          }
        },
        roundTrip: {
          on: {
            CHANGE_TRIP_TYPE: {
              target: 'oneWay'
            },
            CHANGE_RETURN_DATE: ({ context, event, guards, actions }, enq) => {
              enq((actionArgs) => actions['setReturnDate'](actionArgs as any));
            },
            BOOK_RETURN: ({ context, event, guards, actions }, enq) => {
              if (!guards['isValidReturnDate?']({ context, event })) {
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
        onError: {
          target: 'scheduling'
        }
      }
    },
    booked: {
      type: 'final'
    }
  }
});
export default createActorContext(flightBookerMachine);
