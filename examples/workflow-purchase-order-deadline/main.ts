import { createMachine, createAsyncLogic, createActor } from 'xstate';
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
export const workflow = createMachine({
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
        OrderCreatedEvent: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['logNewOrderCreated'](actionArgs as any));
          return { target: 'WaitForOrderConfirmation' };
        }
      }
    },
    WaitForOrderConfirmation: {
      on: {
        OrderConfirmedEvent: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['logOrderConfirmed'](actionArgs as any));
          return { target: 'WaitOrderShipped' };
        }
      }
    },
    WaitOrderShipped: {
      on: {
        ShipmentSentEvent: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['logOrderShipped'](actionArgs as any));
          return { target: 'OrderFinished' };
        }
      }
    },
    OrderFinished: {
      type: 'final',
      entry: (args, enq) => {
        enq((actionArgs) =>
          args.actions['logOrderFinished'](actionArgs as any)
        );
      }
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
      entry: (args, enq) => {
        enq((actionArgs) =>
          args.actions['logOrderCancelled'](actionArgs as any)
        );
      }
    }
  },
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
  actorSources: {
    CancelOrder: createAsyncLogic({
      run: async () => {
        console.log('Starting CancelOrder');
        await delay(1000);
        console.log('Completed CancelOrder');
      }
    })
  }
});
const actor = createActor(workflow);
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
actor.send({
  type: 'OrderCreatedEvent'
});
await delay(10000);
actor.send({
  type: 'OrderConfirmedEvent'
});
await delay(10000);
actor.send({
  type: 'ShipmentSentEvent'
});
