import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Each branch runs one of these. They finish at different times on purpose. */
const check = (name: string, ms: number, result: string) =>
  createAsyncLogic({
    run: async () => {
      log(`${name}: started`);
      await wait(ms);
      log(`${name}: finished after ${ms}ms`);
      return result;
    }
  });

const checkoutMachine = setup({
  schemas: {
    context: types<{
      inventory: string | null;
      payment: string | null;
      fraud: string | null;
    }>()
  },
  actors: {
    checkInventory: check('inventory', 300, 'in stock'),
    authorizePayment: check('payment', 900, 'authorized'),
    screenForFraud: check('fraud', 600, 'clean')
  }
}).createMachine({
  context: { inventory: null, payment: null, fraud: null },
  initial: 'checking',
  states: {
    checking: {
      type: 'parallel',
      states: {
        inventory: {
          initial: 'running',
          states: {
            running: {
              invoke: {
                src: ({ actors }) => actors.checkInventory,
                onDone: ({ event }) => ({
                  target: 'done',
                  context: { inventory: event.output }
                })
              }
            },
            done: { type: 'final' }
          }
        },
        payment: {
          initial: 'running',
          states: {
            running: {
              invoke: {
                src: ({ actors }) => actors.authorizePayment,
                onDone: ({ event }) => ({
                  target: 'done',
                  context: { payment: event.output }
                })
              }
            },
            done: { type: 'final' }
          }
        },
        fraud: {
          initial: 'running',
          states: {
            running: {
              invoke: {
                src: ({ actors }) => actors.screenForFraud,
                onDone: ({ event }) => ({
                  target: 'done',
                  context: { fraud: event.output }
                })
              }
            },
            done: { type: 'final' }
          }
        }
      },
      // Runs only once every region has reached its final state.
      onDone: { target: 'approved' }
    },
    approved: {
      type: 'final',
      output: ({ context }) => context
    }
  }
});

const actor = createActor(checkoutMachine, { inspect: inspector?.inspect });

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

log(`joined: ${JSON.stringify(await toPromise(actor))}`);

inspector?.destroy();
