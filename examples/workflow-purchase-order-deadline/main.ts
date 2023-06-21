import {
  assign,
  createMachine,
  forwardTo,
  fromPromise,
  interpret,
  sendParent
} from 'xstate';
import { retry, handleWhen, ConstantBackoff } from 'cockatiel';

const retryPolicy = retry(
  handleWhen((err) => (err as any).type === 'ServiceNotAvailable'),
  {
    maxAttempts: 10,
    backoff: new ConstantBackoff(3000)
  }
);

retryPolicy.onRetry((data) => {
  console.log('Retrying...', data);
});

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

// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#purchase-order-deadline
export const workflow = createMachine(
  {
    id: 'order',
    types: {} as {
      events:
        | {
            type: 'OrderCreatedEvent';
          }
        | {
            type: 'OrderConfirmedEvent';
          }
        | {
            type: 'ShipmentSentEvent';
          }
        | {
            type: 'OrderFinishedEvent';
          };
    },
    initial: 'StartNewOrder',
    after: {
      PT30D: { target: '.CancelOrder' }
    },
    states: {
      StartNewOrder: {
        on: {
          OrderCreatedEvent: {
            actions: ['logNewOrderCreated'],
            target: 'WaitForOrderConfirmation'
          }
        }
      },
      WaitForOrderConfirmation: {
        on: {
          OrderConfirmedEvent: {
            actions: ['logOrderConfirmed'],
            target: 'WaitOrderShipped'
          }
        }
      },
      WaitOrderShipped: {
        on: {
          ShipmentSentEvent: {
            actions: ['logOrderShipped'],
            target: 'OrderFinished'
          }
        }
      },
      OrderFinished: {
        type: 'final',
        entry: ['logOrderFinished']
      },
      CancelOrder: {
        invoke: {
          src: 'CancelOrder',
          onDone: {
            target: 'OrderCancelled'
          }
        }
      },
      OrderCancelled: {
        type: 'final',
        entry: ['logOrderCancelled']
      }
    }
  },
  {
    delays: {
      // 15 seconds instead of 30 days
      PT30D: 15 * 1000
    },
    actions: {
      logNewOrderCreated: () => {
        console.log('logNewOrderCreated');
      },
      logOrderConfirmed: () => {
        console.log('logOrderConfirmed');
      },
      logOrderShipped: () => {
        console.log('logOrderShipped');
      },
      logOrderFinished: () => {
        console.log('logOrderFinished');
      },
      logOrderCancelled: () => {
        console.log('logOrderCancelled');
      }
    },
    actors: {
      CancelOrder: fromPromise(async () => {
        console.log('Starting CancelOrder');
        await delay(1000);
        console.log('Completed CancelOrder');
      })
    }
  }
);

const actor = interpret(workflow);

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

actor.send({
  type: 'OrderCreatedEvent'
});

await delay(10_000);

actor.send({
  type: 'OrderConfirmedEvent'
});

await delay(10_000);

actor.send({
  type: 'ShipmentSentEvent'
});
