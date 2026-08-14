import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const SECRET = 'whsec_demo';

interface Delivery {
  deliveryId: string;
  event: string;
  body: string;
  signature: string;
}

type Outcome = 'processed' | 'duplicate' | 'bad-signature' | 'poison';

/** A stand-in for an HMAC check; the demo signs with a plain prefix. */
const sign = (body: string) => `${SECRET}:${body.length}`;

const verifySignature = createAsyncLogic({
  run: async ({ input }: { input: { delivery: Delivery } }) => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (input.delivery.signature !== sign(input.delivery.body)) {
      throw new Error('SignatureMismatch');
    }
    return { verified: true };
  }
});

const handleEvent = createAsyncLogic({
  run: async ({ input }: { input: { delivery: Delivery } }) => {
    await new Promise((resolve) => setTimeout(resolve, 60));
    const payload = JSON.parse(input.delivery.body) as { amount?: number };
    if (typeof payload.amount !== 'number') {
      throw new Error('UnprocessablePayload');
    }
    return { handled: `${input.delivery.event}:${payload.amount}` };
  }
});

const processorMachine = setup({
  schemas: {
    context: types<{
      inbox: Delivery[];
      current: Delivery | null;
      seen: string[];
      results: Array<{ deliveryId: string; outcome: Outcome }>;
    }>(),
    input: types<{ inbox: Delivery[] }>()
  },
  guards: {
    // Idempotency: the delivery id set in context is the dedupe key.
    isDuplicate: ({
      context
    }: {
      context: { seen: string[]; current: Delivery | null };
    }) =>
      context.current !== null &&
      context.seen.includes(context.current.deliveryId)
  }
}).createMachine({
  context: ({ input }) => ({
    inbox: input.inbox,
    current: null,
    seen: [],
    results: []
  }),
  initial: 'receiving',
  states: {
    receiving: {
      always: ({ context }) => {
        const [current, ...inbox] = context.inbox;
        if (!current) {
          return { target: 'idle' };
        }
        return { target: 'deduping', context: { current, inbox } };
      }
    },
    deduping: {
      entry: ({ context }, enq) =>
        enq(
          log,
          `received ${context.current!.deliveryId} (${context.current!.event})`
        ),
      always: ({ context, guards }) =>
        guards.isDuplicate({ context })
          ? { target: 'settled' }
          : { target: 'verifying' }
    },
    verifying: {
      invoke: {
        src: verifySignature,
        input: ({ context }) => ({ delivery: context.current! }),
        onDone: { target: 'processing' },
        onError: ({ context }, enq) => {
          enq(log, `  rejected ${context.current!.deliveryId}: bad signature`);
          return {
            target: 'receiving',
            context: {
              results: [
                ...context.results,
                {
                  deliveryId: context.current!.deliveryId,
                  outcome: 'bad-signature' as const
                }
              ],
              current: null
            }
          };
        }
      }
    },
    processing: {
      invoke: {
        src: handleEvent,
        input: ({ context }) => ({ delivery: context.current! }),
        onDone: ({ context, event }, enq) => {
          enq(
            log,
            `  processed ${context.current!.deliveryId} -> ${event.output.handled}`
          );
          return {
            target: 'receiving',
            context: {
              seen: [...context.seen, context.current!.deliveryId],
              results: [
                ...context.results,
                {
                  deliveryId: context.current!.deliveryId,
                  outcome: 'processed' as const
                }
              ],
              current: null
            }
          };
        },
        // Poison message: it verified, but it can never be handled, so it is
        // recorded and dropped instead of retried forever.
        onError: ({ context, event }, enq) => {
          enq(
            log,
            `  poison ${context.current!.deliveryId}: ${(event.error as Error).message}`
          );
          return {
            target: 'receiving',
            context: {
              seen: [...context.seen, context.current!.deliveryId],
              results: [
                ...context.results,
                {
                  deliveryId: context.current!.deliveryId,
                  outcome: 'poison' as const
                }
              ],
              current: null
            }
          };
        }
      }
    },
    settled: {
      always: ({ context }, enq) => {
        enq(log, `  skipped ${context.current!.deliveryId}: already processed`);
        return {
          target: 'receiving',
          context: {
            results: [
              ...context.results,
              {
                deliveryId: context.current!.deliveryId,
                outcome: 'duplicate' as const
              }
            ],
            current: null
          }
        };
      }
    },
    idle: {
      type: 'final',
      output: ({ context }) => ({
        handled: context.results.length,
        results: context.results
      })
    }
  }
});

const body = (amount: unknown) => JSON.stringify({ amount });

const inbox: Delivery[] = [
  {
    deliveryId: 'dlv-1',
    event: 'payment.succeeded',
    body: body(4200),
    signature: sign(body(4200))
  },
  {
    deliveryId: 'dlv-2',
    event: 'payment.succeeded',
    body: body(1500),
    signature: 'whsec_wrong:7'
  },
  // Same delivery id as dlv-1: the retry the provider sends after a timeout.
  {
    deliveryId: 'dlv-1',
    event: 'payment.succeeded',
    body: body(4200),
    signature: sign(body(4200))
  },
  {
    deliveryId: 'dlv-3',
    event: 'invoice.updated',
    body: body('not-a-number'),
    signature: sign(body('not-a-number'))
  }
];

const actor = createActor(processorMachine, {
  input: { inbox },
  inspect: inspector?.inspect
});

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

log(`summary: ${JSON.stringify(await toPromise(actor), null, 2)}`);

inspector?.destroy();
