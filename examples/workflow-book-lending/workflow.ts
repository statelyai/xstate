import { types, createMachine, createAsyncLogic } from 'xstate';
async function delay(ms: number, errorProbability: number = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < errorProbability) {
        reject(
          Object.assign(new Error('ServiceNotAvailable'), {
            type: 'ServiceNotAvailable'
          })
        );
      } else {
        resolve();
      }
    }, ms);
  });
}
interface Lender {
  name: string;
  address: string;
  phone: string;
}
// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#book-lending
export const workflow = createMachine({
  schemas: {
    context: types<{
      book: {
        title: string;
        id: string;
        status: 'onloan' | 'available' | 'unknown';
      } | null;
      lender: Lender | null;
    }>(),
    events: {
      bookLendingRequest: types<{
        type: 'bookLendingRequest';
        book: {
          title: string;
          id: string;
        };
        lender: Lender;
      }>(),
      holdBook: types<{
        type: 'holdBook';
      }>(),
      declineBookhold: types<{
        type: 'declineBookhold';
      }>()
    }
  },
  initial: 'Book Lending Request',
  context: {
    book: null,
    lender: null
  },
  states: {
    'Book Lending Request': {
      on: {
        bookLendingRequest: ({ context, event }) => {
          return {
            target: 'Get Book Status',
            context: {
              ...context,
              lender: event.lender,
              book: {
                ...event.book,
                status: 'unknown' as const
              }
            }
          };
        }
      }
    },
    'Get Book Status': {
      invoke: {
        src: 'Get status for book',
        input: ({ context }) => ({
          bookid: context.book!.id
        }),
        onDone: ({ context, event }) => {
          return {
            target: 'Book Status Decision',
            context: {
              ...context,
              book: {
                ...context.book!,
                status: event.output.status
              }
            }
          };
        }
      }
    },
    'Book Status Decision': {
      always: ({ context }) => {
        if (context.book!.status === 'onloan') {
          return { target: 'Report Status To Lender' };
        }
        if (context.book!.status === 'available') {
          return { target: 'Check Out Book' };
        }
        return {
          target: 'End'
        };
      }
    },
    'Report Status To Lender': {
      invoke: {
        src: 'Send status to lender',
        input: ({ context }) => ({
          bookid: context.book!.id,
          message: `Book ${context.book!.title} is already on loan`
        }),
        onDone: {
          target: 'Wait for Lender response'
        }
      }
    },
    'Wait for Lender response': {
      on: {
        holdBook: {
          target: 'Request Hold'
        },
        declineBookhold: {
          target: 'Cancel Request'
        }
      }
    },
    'Request Hold': {
      invoke: {
        src: 'Request hold for lender',
        input: ({ context }) => ({
          bookid: context.book!.id,
          lender: context.lender!
        }),
        onDone: {
          target: 'Sleep two weeks'
        }
      }
    },
    'Cancel Request': {
      invoke: {
        src: 'Cancel hold request for lender',
        input: ({ context }) => ({
          bookid: context.book!.id,
          lender: context.lender!
        }),
        onDone: {
          target: 'End'
        }
      }
    },
    'Sleep two weeks': {
      after: {
        PT2W: {
          target: 'Get Book Status'
        }
      }
    },
    'Check Out Book': {
      onDone: { target: 'End' },
      initial: 'Checking out book',
      states: {
        'Checking out book': {
          invoke: {
            src: 'Check out book with id',
            input: ({ context }) => ({
              bookid: context.book!.id
            }),
            onDone: {
              target: 'Notifying Lender'
            }
          }
        },
        'Notifying Lender': {
          invoke: {
            src: 'Notify Lender for checkout',
            input: ({ context }) => ({
              bookid: context.book!.id,
              lender: context.lender!
            }),
            onDone: {
              target: 'End'
            }
          }
        },
        End: {
          type: 'final'
        }
      }
    },
    End: {
      type: 'final'
    }
  },
  actors: {
    'Get status for book': createAsyncLogic({
      schemas: { input: types<{ bookid: string }>() },
      run: async ({ input }): Promise<{ status: 'onloan' | 'available' }> => {
        console.log('Starting Get status for book', input);
        await delay(1000);
        return {
          status: 'available' as const
        };
      }
    }),
    'Send status to lender': createAsyncLogic({
      schemas: { input: types<{ bookid: string; message: string }>() },
      run: async ({ input }) => {
        console.log('Starting Send status to lender', input);
        await delay(1000);
      }
    }),
    'Request hold for lender': createAsyncLogic({
      schemas: {
        input: types<{
          bookid: string;
          lender: Lender;
        }>()
      },
      run: async ({ input }) => {
        console.log('Starting Request hold for lender', input);
        await delay(1000);
      }
    }),
    'Cancel hold request for lender': createAsyncLogic({
      schemas: {
        input: types<{
          bookid: string;
          lender: Lender;
        }>()
      },
      run: async ({ input }) => {
        console.log('Starting Cancel hold request for lender', input);
        await delay(1000);
      }
    }),
    'Check out book with id': createAsyncLogic({
      schemas: {
        input: types<{
          bookid: string;
        }>()
      },
      run: async ({ input }) => {
        console.log('Starting Check out book with id', input);
        await delay(1000);
      }
    }),
    'Notify Lender for checkout': createAsyncLogic({
      schemas: {
        input: types<{
          bookid: string;
          lender: Lender;
        }>()
      },
      run: async ({ input }) => {
        console.log('Starting Notify Lender for checkout', input);
        await delay(1000);
      }
    })
  }
});
