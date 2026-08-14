import { createActor, setup, toPromise, types } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Bid {
  bidder: string;
  amount: number;
}

const auctionMachine = setup({
  schemas: {
    context: types<{ lot: string; bids: Bid[] }>(),
    events: { bid: types<{ bidder: string; amount: number }>() },
    input: types<{ lot: string }>()
  },
  delays: { biddingWindow: 2000 }
}).createMachine({
  context: ({ input }) => ({ lot: input.lot, bids: [] }),
  initial: 'open',
  states: {
    open: {
      on: {
        // Every accepted bid is appended to context. Late or too-low bids are
        // rejected by returning `undefined`, which means "no transition".
        bid: ({ context, event }, enq) => {
          const highest = context.bids.at(-1)?.amount ?? 0;
          if (event.amount <= highest) {
            enq(
              log,
              `rejected ${event.bidder} $${event.amount} (below $${highest})`
            );
            return undefined;
          }
          enq(log, `accepted ${event.bidder} $${event.amount}`);
          return {
            context: {
              bids: [
                ...context.bids,
                { bidder: event.bidder, amount: event.amount }
              ]
            }
          };
        }
      },
      after: { biddingWindow: { target: 'closed' } }
    },
    closed: {
      type: 'final',
      output: ({ context }) => ({
        lot: context.lot,
        bidCount: context.bids.length,
        winner: context.bids.at(-1) ?? null
      })
    }
  }
});

const actor = createActor(auctionMachine, {
  input: { lot: 'Lot 7: vintage sign' },
  inspect: inspector?.inspect
});

actor.subscribe((snapshot) =>
  log(
    `state: ${JSON.stringify(snapshot.value)} bids: ${snapshot.context.bids.length}`
  )
);

actor.start();

const incoming: Array<[number, Bid]> = [
  [300, { bidder: 'ada', amount: 100 }],
  [400, { bidder: 'grace', amount: 150 }],
  [300, { bidder: 'alan', amount: 120 }], // too low, ignored
  [400, { bidder: 'ada', amount: 200 }],
  [2000, { bidder: 'grace', amount: 500 }] // arrives after the window closed
];

void (async () => {
  for (const [delay, bid] of incoming) {
    await wait(delay);
    actor.send({ type: 'bid', ...bid });
  }
})();

log(`sold: ${JSON.stringify(await toPromise(actor))}`);

inspector?.destroy();
