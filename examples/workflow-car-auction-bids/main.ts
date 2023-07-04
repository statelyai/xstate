import { assign, createMachine, fromPromise, interpret } from 'xstate';

interface Bid {
  carid: string;
  amount: number;
  bidder: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

// https://github.com/serverlessworkflow/specification/tree/main/examples#handle-car-auction-bids-example
export const workflow = createMachine(
  {
    id: 'handleCarAuctionBid',
    description: 'Store a single bid whole the car auction is active',
    initial: 'StoreCarAuctionBid',
    types: {} as {
      context: {
        bids: Bid[];
      };
      events: {
        type: 'CarBidEvent';
        bid: Bid;
      };
    },
    context: {
      bids: []
    },
    states: {
      StoreCarAuctionBid: {
        on: {
          CarBidEvent: {
            actions: assign({
              bids: ({ context, event }) => [...context.bids, event.bid]
            })
          }
        },
        after: {
          BiddingDelay: 'BiddingEnded'
        }
      },
      BiddingEnded: {
        type: 'final',
        output: ({ context }) => ({
          // highest bid
          winningBid: context.bids.reduce((prev, current) =>
            prev.amount > current.amount ? prev : current
          )
        })
      }
    }
  },
  {
    delays: {
      BiddingDelay: 3000
    }
  }
);

const actor = interpret(workflow);

actor.subscribe({
  next(state) {
    console.log('Received event', state.event, state.value);
    console.log(state.context);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

// delay 1000
await new Promise((resolve) => setTimeout(resolve, 1000));

actor.send({
  type: 'CarBidEvent',
  bid: {
    carid: 'car123',
    amount: 3000,
    bidder: {
      id: 'xyz',
      firstName: 'John',
      lastName: 'Wayne'
    }
  }
});

// delay 1000
await new Promise((resolve) => setTimeout(resolve, 1000));

actor.send({
  type: 'CarBidEvent',
  bid: {
    carid: 'car123',
    amount: 4000,
    bidder: {
      id: 'abc',
      firstName: 'Jane',
      lastName: 'Doe'
    }
  }
});
