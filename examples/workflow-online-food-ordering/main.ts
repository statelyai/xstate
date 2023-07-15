import { assign, createMachine, fromPromise, interpret } from 'xstate';

// id: foodorderworkflow
// name: Food Order Workflow
// version: '1.0.0'
// specVersion: '0.8'
// start: Place Order
// functions: file://orderfunctions.yml
// events: file://orderevents.yml
// states:
// - name: Place Order
//   type: operation
//   actions:
//   - subFlowRef: placeorderworkflow
//   transition: Wait for ETA Deadline
// - name: Wait for ETA Deadline
//   type: event
//   onEvents:
//   - eventRefs:
//     - ETA Deadline Event
//     eventDataFilter:
//       data: "${ .results.status }"
//       toStateData: "${ .status }"
//   transition: Deliver Order
// - name: Deliver Order
//   type: operation
//   actions:
//   - subFlowRef: deliverorderworkflow
//   transition: Charge For Order
// - name: Charge For Order
//   type: operation
//   actions:
//   - functionRef:
//       refName: Charge For Order Function
//       arguments:
//         order: "${ .order.id }"
//     actionDataFilter:
//       results: "${ .outcome.status }"
//       toStateData: "${ .status }"
//   stateDataFilter:
//     output: '${ . | {"orderid": .id, "orderstatus": .status} | .orderstatus += ["Order
//       Completed"] }'
//   end: true

export const workflow = createMachine(
  {
    id: 'foodorderworkflow',
    initial: 'Place Order',
    types: {} as {
      context: {
        order: {
          id: string;
        };
        status: string | null;
      };
    },
    context: ({ input }) => ({
      order: input.order,
      status: null
    }),
    states: {
      'Place Order': {
        invoke: {
          src: 'placeorderworkflow',
          onDone: { target: 'Deliver Order' },
          onError: { target: 'Failure' }
        }
      },

      'Deliver Order': {
        invoke: {
          src: 'deliverorderworkflow',
          onDone: { target: 'Charge For Order' },

          onError: { target: 'Failure' }
        }
      },

      'Charge For Order': {
        invoke: {
          src: 'chargefororderfunction',

          input: ({ context }) => ({
            order: context.order.id
          }),

          onDone: {
            target: 'Order Finished',
            actions: assign({
              status: ({ event }) => event.output.results
            })
          },

          onError: 'Failure'
        }
      },

      'Order Finished': {
        type: 'final',
        output: ({ context }) => ({
          message: 'Order completed'
        })
      },

      Failure: {
        type: 'final'
      }
    }
  },
  {
    actors: {
      placeorderworkflow: fromPromise(async () => {
        // wait for 1 second
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return {
          status: 'Order placed'
        };
      }),
      deliverorderworkflow: fromPromise(async () => {
        // wait for 2 seconds
        await new Promise((resolve) => setTimeout(resolve, 2000));

        return {
          status: 'Order delivered'
        };
      }),
      chargefororderfunction: fromPromise(async () => {
        // wait for 3 seconds
        await new Promise((resolve) => setTimeout(resolve, 3000));

        return {
          status: 'Order charged'
        };
      })
    }
  }
);

const actor = interpret(workflow, {
  input: {
    order: {
      id: 'CH1CK3NP3570'
      // some more leet-speak food items:
      // 8URG3R
      // 5U5H1
      // 7AC05
    }
  }
});

actor.subscribe({
  next(state) {
    console.log('Received event', state.event, state.value);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
