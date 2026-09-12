import { types, createMachine } from 'xstate';

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
export const workflow = createMachine({
  id: 'handleCarAuctionBid',
  description: 'Store a single bid whole the car auction is active',
  initial: 'StoreCarAuctionBid',
  schemas: {
    context: types<{
      bids: Bid[];
    }>(),
    events: {
      CarBidEvent: types<{
        type: 'CarBidEvent';
        bid: Bid;
      }>()
    }
  },
  context: {
    bids: []
  },
  states: {
    StoreCarAuctionBid: {
      on: {
        CarBidEvent: ({ context, event }) => {
          return {
            context: {
              ...context,
              bids: [...context.bids, event.bid]
            }
          };
        }
      },
      after: {
        BiddingDelay: { target: 'BiddingEnded' }
      }
    },
    BiddingEnded: {
      type: 'final',
      output: ({ context }) => ({
        // highest bid
        winningBid: context.bids.reduce<Bid | undefined>(
          (prev, current) =>
            prev && prev.amount > current.amount ? prev : current,
          undefined
        )
      })
    }
  },
  delays: {
    BiddingDelay: 3000
  }
});
