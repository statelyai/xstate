import { createSystem, toPromise, types, createCallbackLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

/** Writes lines. Nothing else in the system holds a reference to it. */
const logger = createCallbackLogic<{ type: 'log'; message: string }>(
  ({ receive }) => {
    receive((event) => log(`[log] ${event.message}`));
  }
);

/**
 * Sends notifications, and logs what it sent by looking the logger up in the
 * system it belongs to. The two actors never know about each other directly.
 */
const notifier = createCallbackLogic<{
  type: 'notify';
  to: string;
  text: string;
}>(({ receive, system }) => {
  receive((event) => {
    log(`[notify] -> ${event.to}: ${event.text}`);
    system
      .get('logger')
      ?.send({ type: 'log', message: `notified ${event.to}` });
  });
});

/**
 * `createSystem` declares the registry up front: the keys, and the logic each
 * key resolves to. `system.get(key)` is typed from this registry.
 */
const system = createSystem({
  registry: { logger, notifier }
});

const orderMachine = system
  .setup({
    schemas: {
      context: types<{ orderId: string; customer: string }>(),
      events: {
        pay: types<{}>(),
        ship: types<{}>()
      },
      input: types<{ orderId: string; customer: string }>()
    }
  })
  .createMachine({
    context: ({ input }) => input,
    // Children registered under a `registryKey` are discoverable system-wide,
    // by any actor, without being passed down through context.
    invoke: [
      { src: logger, registryKey: 'logger' },
      { src: notifier, registryKey: 'notifier' }
    ],
    initial: 'awaitingPayment',
    states: {
      awaitingPayment: {
        // `system` is optional in entry action arguments, unlike in transition
        // functions, so it is read with `?.` here.
        entry: ({ context, system }, enq) => {
          enq.sendTo(system?.get('logger'), {
            type: 'log',
            message: `order ${context.orderId} created`
          });
        },
        on: {
          pay: ({ context, system }, enq) => {
            enq.sendTo(system.get('notifier'), {
              type: 'notify',
              to: context.customer,
              text: 'Payment received'
            });
            return { target: 'paid' };
          }
        }
      },
      paid: {
        on: {
          ship: ({ context, system }, enq) => {
            enq.sendTo(system.get('notifier'), {
              type: 'notify',
              to: context.customer,
              text: 'Your order is on its way'
            });
            return { target: 'shipped' };
          }
        }
      },
      shipped: {
        type: 'final',
        output: ({ context }) => ({ orderId: context.orderId })
      }
    }
  });

// `system.createActor` starts the root actor inside this system.
const actor = system.createActor(orderMachine, {
  input: { orderId: 'ord-1001', customer: 'ada@example.com' },
  inspect: inspector?.inspect
});

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

log(`registered: ${Object.keys(system.getAll()).join(', ')}`);

actor.send({ type: 'pay' });
actor.send({ type: 'ship' });

log(`result: ${JSON.stringify(await toPromise(actor))}`);

inspector?.destroy();
