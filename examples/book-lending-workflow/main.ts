#!/usr/bin/env vite-node --script
import {
  assign,
  createMachine,
  forwardTo,
  fromPromise,
  interpret,
  sendParent
} from 'xstate';

async function delay(ms: number, errorProbability: number = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < errorProbability) {
        reject({ type: 'ServiceNotAvailable' });
      } else {
        resolve();
      }
    }, ms);
  });
}

// id: booklending
// name: Book Lending Workflow
// version: '1.0.0'
// specVersion: '0.8'
// start: Book Lending Request
// states:
//  - name: Book Lending Request
//    type: event
//    onEvents:
//     - eventRefs:
//        - Book Lending Request Event
//    transition: Get Book Status
//  - name: Get Book Status
//    type: operation
//    actions:
//     - functionRef:
//        refName: Get status for book
//        arguments:
//         bookid: "${ .book.id }"
//    transition: Book Status Decision
//  - name: Book Status Decision
//    type: switch
//    dataConditions:
//     - name: Book is on loan
//       condition: ${ .book.status == "onloan" }
//       transition: Report Status To Lender
//     - name: Check is available
//       condition: ${ .book.status == "available" }
//       transition: Check Out Book
//    defaultCondition:
//     end: true
//  - name: Report Status To Lender
//    type: operation
//    actions:
//     - functionRef:
//        refName: Send status to lender
//        arguments:
//         bookid: "${ .book.id }"
//         message: Book ${ .book.title } is already on loan
//    transition: Wait for Lender response
//  - name: Wait for Lender response
//    type: switch
//    eventConditions:
//     - name: Hold Book
//       eventRef: Hold Book Event
//       transition: Request Hold
//     - name: Decline Book Hold
//       eventRef: Decline Hold Event
//       transition: Cancel Request
//    defaultCondition:
//     end: true
//  - name: Request Hold
//    type: operation
//    actions:
//     - functionRef:
//        refName: Request hold for lender
//        arguments:
//         bookid: "${ .book.id }"
//         lender: "${ .lender }"
//    transition: Sleep two weeks
//  - name: Cancel Request
//    type: operation
//    actions:
//     - functionRef:
//        refName: Cancel hold request for lender
//        arguments:
//         bookid: "${ .book.id }"
//         lender: "${ .lender }"
//    end: true
//  - name: Sleep two weeks
//    type: sleep
//    duration: PT2W
//    transition: Get Book Status
//  - name: Check Out Book
//    type: operation
//    actions:
//     - functionRef:
//        refName: Check out book with id
//        arguments:
//         bookid: "${ .book.id }"
//     - functionRef:
//        refName: Notify Lender for checkout
//        arguments:
//         bookid: "${ .book.id }"
//         lender: "${ .lender }"
//    end: true
// functions: file://books/lending/functions.json
// events: file://books/lending/events.json

// A book lending request event looks like this:
// {
//   "book": {
//       "title": " ... ",
//       "id": " ... "
//   },
//   "lender": {
//       "name": "John Doe",
//       "address": " ... ",
//       "phone": " ... "
//   }
// }

// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#book-lending
export const workflow = createMachine(
  {
    types: {} as {
      context: {
        book: {
          title: string;
          id: string;
          status: 'onloan' | 'available' | 'unknown';
        } | null;
      };
      events:
        | {
            type: 'bookLendingRequest';
            book: {
              title: string;
              id: string;
            };
            lender: {
              name: string;
              address: string;
              phone: string;
            };
          }
        | {
            type: 'holdBook';
          }
        | {
            type: 'declineBookhold';
          };
    },
    initial: 'Book Lending Request',
    context: {
      book: null
    },
    states: {
      'Book Lending Request': {
        on: {
          bookLendingRequest: {
            target: 'Get Book Status',
            actions: assign({
              book: ({ event }) => ({
                ...event.book,
                status: 'unknown' as const
              })
            })
          }
        }
      },
      'Get Book Status': {
        invoke: {
          src: 'Get status for book',
          input: ({ context }) => ({
            bookid: context.book!.id
          }),
          onDone: {
            target: 'Book Status Decision',
            actions: assign({
              book: ({ context, event }) => ({
                ...context.book!,
                status: event.output.status
              })
            })
          }
        }
      },
      'Book Status Decision': {
        always: [
          {
            guard: ({ context }) => context.book!.status === 'onloan',
            target: 'Report Status To Lender'
          },
          {
            guard: ({ context }) => context.book!.status === 'available',
            target: 'Check Out Book'
          },
          {
            target: 'End'
          }
        ]
      },
      'Report Status To Lender': {
        invoke: {
          src: 'Send status to lender',
          input: ({ context }) => ({
            bookid: context.book.id,
            message: `Book ${context.book.title} is already on loan`
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
            bookid: context.book.id,
            lender: context.lender
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
            bookid: context.book.id,
            lender: context.lender
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
        initial: 'Checking out book',
        states: {
          'Checking out book': {
            invoke: {
              src: 'Check out book with id',
              input: ({ context }) => ({
                bookid: context.book.id
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
                bookid: context.book.id,
                lender: context.lender
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
    }
  },
  {
    actors: {
      'Get status for book': fromPromise(async ({ input }) => {
        console.log('Starting Get status for book', input);
        await delay(1000);

        return {
          status: 'available'
        };
      }),
      'Send status to lender': fromPromise(async ({ input }) => {
        console.log('Starting Send status to lender', input);
        await delay(1000);
      }),
      'Request hold for lender': fromPromise(async ({ input }) => {
        console.log('Starting Request hold for lender', input);
        await delay(1000);
      }),
      'Cancel hold request for lender': fromPromise(async ({ input }) => {
        console.log('Starting Cancel hold request for lender', input);
        await delay(1000);
      }),
      'Check out book with id': fromPromise(async ({ input }) => {
        console.log('Starting Check out book with id', input);
        await delay(1000);
      }),
      'Notify Lender for checkout': fromPromise(async ({ input }) => {
        console.log('Starting Notify Lender for checkout', input);
        await delay(1000);
      })
    }
  }
);

const actor = interpret(workflow);

actor.subscribe({
  next(snapshot) {
    console.log(snapshot.context);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

actor.send({
  type: 'bookLendingRequest',
  book: {
    title: "The Hitchhiker's Guide to the Galaxy",
    id: '42'
  },
  lender: {
    name: 'John Doe',
    address: ' ... ',
    phone: ' ... '
  }
});
