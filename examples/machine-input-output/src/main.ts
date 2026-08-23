import { createActor, setup, toPromise, types } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) => console.log(message);

type Quote = {
  label: string;
  monthlyPayment: number;
  totalInterest: number;
};

/**
 * Child machine. Everything it needs arrives as `input`; everything the parent
 * gets back leaves as the `output` of its final state.
 */
const loanQuoteMachine = setup({
  schemas: {
    context: types<{
      label: string;
      principal: number;
      apr: number;
      months: number;
    }>(),
    input: types<{
      label: string;
      principal: number;
      apr: number;
      years: number;
    }>(),
    output: types<Quote>()
  }
}).createMachine({
  // `context` is a function of `input`, which is the only way values enter a
  // machine from the outside.
  context: ({ input }) => ({
    label: input.label,
    principal: input.principal,
    apr: input.apr,
    months: input.years * 12
  }),
  initial: 'quoting',
  states: {
    quoting: {
      always: { target: 'quoted' }
    },
    quoted: {
      type: 'final',
      // The final state's `output` becomes the actor's output, and the parent
      // reads it from `event.output` in `onDone`.
      output: ({ context }): Quote => {
        const rate = context.apr / 100 / 12;
        const monthlyPayment =
          rate === 0
            ? context.principal / context.months
            : (context.principal * rate) / (1 - (1 + rate) ** -context.months);
        return {
          label: context.label,
          monthlyPayment: Math.round(monthlyPayment * 100) / 100,
          totalInterest:
            Math.round(
              (monthlyPayment * context.months - context.principal) * 100
            ) / 100
        };
      }
    }
  }
});

type Offer = { label: string; apr: number; years: number };

const OFFERS: [Offer, Offer, Offer] = [
  { label: '3-year @ 6.9%', apr: 6.9, years: 3 },
  { label: '5-year @ 7.4%', apr: 7.4, years: 5 },
  { label: '7-year @ 8.1%', apr: 8.1, years: 7 }
];

/**
 * Parent machine. It runs the same child three times with different input and
 * compares the three outputs.
 */
const compareOffersMachine = setup({
  schemas: {
    context: types<{
      principal: number;
      quotes: Quote[];
      error: string | null;
    }>(),
    input: types<{ principal: number }>(),
    // Declaring the output type makes `toPromise(actor)` typed at the call site.
    output: types<
      | { ok: true; principal: number; quotes: Quote[]; cheapest: Quote }
      | { ok: false; error: string | null }
    >()
  },
  guards: {
    // Input arrives from outside the program, so it is checked before use.
    // A guard keeps the check declarative and reusable.
    hasValidPrincipal: (principal: number) =>
      Number.isFinite(principal) && principal >= 1_000 && principal <= 1_000_000
  },
  actors: { loanQuoteMachine }
}).createMachine({
  context: ({ input }) => ({
    principal: input.principal,
    quotes: [],
    error: null
  }),
  initial: 'validating',
  states: {
    validating: {
      always: ({ context, guards }) =>
        guards.hasValidPrincipal(context.principal)
          ? { target: 'quotingA' }
          : {
              target: 'rejected',
              context: {
                error: `principal ${context.principal} is outside 1000..1000000`
              }
            }
    },
    quotingA: {
      invoke: {
        src: 'loanQuoteMachine',
        // Each invocation parameterizes the same child differently.
        input: ({ context }) => ({
          ...OFFERS[0],
          principal: context.principal
        }),
        onDone: ({ context, event }) => ({
          target: 'quotingB',
          context: { quotes: [...context.quotes, event.output] }
        })
      }
    },
    quotingB: {
      invoke: {
        src: 'loanQuoteMachine',
        input: ({ context }) => ({
          ...OFFERS[1],
          principal: context.principal
        }),
        onDone: ({ context, event }) => ({
          target: 'quotingC',
          context: { quotes: [...context.quotes, event.output] }
        })
      }
    },
    quotingC: {
      invoke: {
        src: 'loanQuoteMachine',
        input: ({ context }) => ({
          ...OFFERS[2],
          principal: context.principal
        }),
        onDone: ({ context, event }) => ({
          target: 'compared',
          context: { quotes: [...context.quotes, event.output] }
        })
      }
    },
    compared: {
      type: 'final',
      output: ({ context }) => ({
        ok: true as const,
        principal: context.principal,
        quotes: context.quotes,
        cheapest: context.quotes.reduce((best, quote) =>
          quote.totalInterest < best.totalInterest ? quote : best
        )
      })
    },
    rejected: {
      type: 'final',
      output: ({ context }) => ({ ok: false as const, error: context.error })
    }
  }
});

async function run(principal: number) {
  log(`\n=== principal: ${principal}`);
  const actor = createActor(compareOffersMachine, {
    input: { principal },
    inspect: inspector?.inspect
  });
  actor.start();
  const output = await toPromise(actor);

  if (!output.ok) {
    log(`rejected: ${output.error}`);
    return;
  }

  for (const quote of output.quotes) {
    log(
      `  ${quote.label}: ${quote.monthlyPayment}/mo, interest ${quote.totalInterest}`
    );
  }
  log(`cheapest: ${output.cheapest.label}`);
}

await run(25_000);
await run(250);

inspector?.destroy();
