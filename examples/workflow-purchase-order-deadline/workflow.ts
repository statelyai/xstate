import { types, createMachine, createAsyncLogic } from 'xstate';
export async function delay(
  ms: number,
  errorProbability: number = 0
): Promise<void> {
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
// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#purchase-order-deadline
export const workflow = createMachine({
  id: 'order',
  schemas: {
    events: {
      OrderCreatedEvent: types<{
        type: 'OrderCreatedEvent';
      }>(),
      OrderConfirmedEvent: types<{
        type: 'OrderConfirmedEvent';
      }>(),
      ShipmentSentEvent: types<{
        type: 'ShipmentSentEvent';
      }>(),
      OrderFinishedEvent: types<{
        type: 'OrderFinishedEvent';
      }>()
    }
  },
  initial: 'StartNewOrder',
  after: {
    PT30D: { target: '.CancelOrder' }
  },
  states: {
    StartNewOrder: {
      on: {
        OrderCreatedEvent: ({ actions }, enq) => {
          enq(actions['logNewOrderCreated']);
          return { target: 'WaitForOrderConfirmation' };
        }
      }
    },
    WaitForOrderConfirmation: {
      on: {
        OrderConfirmedEvent: ({ actions }, enq) => {
          enq(actions['logOrderConfirmed']);
          return { target: 'WaitOrderShipped' };
        }
      }
    },
    WaitOrderShipped: {
      on: {
        ShipmentSentEvent: ({ actions }, enq) => {
          enq(actions['logOrderShipped']);
          return { target: 'OrderFinished' };
        }
      }
    },
    OrderFinished: {
      type: 'final',
      entry: (args, enq) => {
        enq(args.actions['logOrderFinished']);
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
        enq(args.actions['logOrderCancelled']);
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
  actors: {
    CancelOrder: createAsyncLogic({
      run: async () => {
        console.log('Starting CancelOrder');
        await delay(1000);
        console.log('Completed CancelOrder');
      }
    })
  }
});
