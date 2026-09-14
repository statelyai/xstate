import { createActor, setup, toPromise, types } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) => console.log(message);

type Publication = { url: string; publishedAt: number };

/**
 * `setup({ states })` declares a contract per state, separate from the
 * machine's behavior. Each state can declare:
 *
 * - `schemas.context` — a refinement of the root context while the state is
 *   active. It only lists the fields that state narrows.
 * - `schemas.input` — data the state is entered *with*. Transitions targeting
 *   the state must supply it, and the state's own functions read `{ input }`.
 * - `schemas.output` — the value the state produces when it completes, which is
 *   what the parent's `onDone` event carries.
 * - structural metadata (`type`, `initial`, `id`, `history`, `target`, `route`).
 */
const reviewSetup = setup({
  schemas: {
    context: types<{
      documentId: string;
      // Optional at the root; individual states narrow these to required.
      draft?: string;
      reviewer?: string;
      rejectionReason?: string;
      publication?: Publication;
    }>(),
    events: {
      submit: types<{ draft: string; reviewer: string }>(),
      approve: types<{}>(),
      reject: types<{ reason: string }>(),
      revise: types<{ draft: string }>()
    },
    // The machine's own output. A top-level final state's `output` is checked
    // against this, but it is not inferred from those states: without this
    // schema, `toPromise(actor)` resolves to `{}`.
    output: types<{ ok: true; url: string } | { ok: false; reason: string }>()
  },
  states: {
    drafting: {},
    reviewing: {
      // While `reviewing`, the draft and the reviewer are guaranteed present.
      schemas: {
        context: types<{ draft: string; reviewer: string }>(),
        // The review deadline belongs to this state, not to the whole machine.
        input: types<{ deadline: number }>()
      }
    },
    // A compound state whose completion output is part of its contract.
    publishing: {
      type: 'compound',
      initial: 'uploading',
      schemas: {
        context: types<{ draft: string }>(),
        output: types<Publication>()
      },
      states: {
        uploading: {},
        stored: {
          type: 'final',
          schemas: { output: types<Publication>() }
        }
      }
    },
    published: {
      type: 'final',
      schemas: { context: types<{ publication: Publication }>() }
    },
    rejected: {
      schemas: { context: types<{ draft: string; rejectionReason: string }>() }
    }
  }
});

const reviewMachine = reviewSetup.createMachine({
  id: 'review',
  context: { documentId: 'doc_42' },
  initial: 'drafting',
  states: {
    drafting: {
      on: {
        // Entering `reviewing` requires both the context refinement it declares
        // and its `input`. Neither is optional at the call site.
        submit: ({ event }) => ({
          target: 'reviewing',
          context: { draft: event.draft, reviewer: event.reviewer },
          input: { deadline: 1_000 }
        })
      }
    },
    reviewing: {
      // `input` here is typed as `{ deadline: number }` from the state contract,
      // and `context.draft` is `string`, not `string | undefined`.
      entry: ({ context, input }) =>
        log(
          `reviewing ${context.draft.length} chars with ${context.reviewer}, deadline ${input.deadline}ms`
        ),
      on: {
        approve: ({ context }) => ({
          target: 'publishing',
          context: { draft: context.draft }
        }),
        reject: ({ context, event }) => ({
          target: 'rejected',
          context: { draft: context.draft, rejectionReason: event.reason }
        })
      }
    },
    publishing: {
      // `initial` comes from the state contract, so the machine config may omit
      // it and the state value stays typed.
      states: {
        uploading: {
          after: {
            10: {
              target: 'stored'
            }
          }
        },
        stored: {
          type: 'final',
          // Checked against this state's declared `schemas.output`.
          output: ({ context }): Publication => ({
            url: `https://example.test/${context.documentId}`,
            publishedAt: 0
          })
        }
      },
      // `event.output` is the `publishing` state's declared output type, not
      // `unknown` and not the machine's output.
      onDone: ({ event }) => ({
        target: 'published',
        context: { publication: event.output }
      })
    },
    published: {
      type: 'final',
      entry: ({ context }) => log(`published at ${context.publication.url}`),
      output: ({ context }) => ({
        ok: true as const,
        url: context.publication.url
      })
    },
    rejected: {
      type: 'final',
      entry: ({ context }) =>
        log(`rejected: ${context.rejectionReason} (draft kept)`),
      output: ({ context }) => ({
        ok: false as const,
        reason: context.rejectionReason
      })
    }
  }
});

/**
 * Compile-time guarantees. Every probe below is a real type error that `tsc`
 * reports as expected; if any of them ever starts compiling, `pnpm typecheck`
 * fails on the unused `@ts-expect-error`.
 */
reviewSetup.createStateConfig('drafting', {
  on: {
    submit: ({ event }) => ({
      target: 'reviewing',
      context: { draft: event.draft, reviewer: event.reviewer },
      input: { deadline: 1 }
    }),
    // @ts-expect-error `reviewing` requires its `input`
    approve: { target: 'reviewing', context: { draft: 'x', reviewer: 'y' } },
    // @ts-expect-error `reviewing` requires the context fields it narrows
    reject: { target: 'reviewing', input: { deadline: 1 } },
    // @ts-expect-error `input.deadline` must be a number
    revise: {
      target: 'reviewing',
      context: { draft: 'x', reviewer: 'y' },
      input: { deadline: 'soon' }
    }
  }
});

reviewSetup.createStateConfig('reviewing', {
  // @ts-expect-error `rejected` narrows `rejectionReason` to a string
  on: { reject: { target: 'rejected', context: { draft: 'x' } } }
});

reviewSetup.createStateConfig('reviewing', {
  entry: ({ context, input }) => {
    // In `reviewing` the narrowed fields are non-optional...
    context.draft.trim();
    input.deadline.toFixed();
    // @ts-expect-error ...but fields no state declares stay optional
    context.publication.url;
    // @ts-expect-error and `input` only has what this state declares
    input.reviewer;
  }
});

/**
 * The runtime flow. Each state carries a different context shape, and the
 * machine's output is a union of the two final states' outputs.
 */
async function run(decision: 'approve' | 'reject') {
  log(`\n=== ${decision}`);
  const actor = createActor(reviewMachine, { inspect: inspector?.inspect });

  actor.subscribe((snapshot) => {
    log(`  state: ${JSON.stringify(snapshot.value)}`);
  });

  actor.start();
  actor.send({
    type: 'submit',
    draft: 'The compact runtime and the full runtime, compared.',
    reviewer: 'ada'
  });

  // State input is readable per state node from the snapshot.
  const inputs = actor.getSnapshot().getInputs();
  log(`  inputs: ${JSON.stringify(inputs)}`);

  if (decision === 'approve') {
    actor.send({ type: 'approve' });
  } else {
    actor.send({ type: 'reject', reason: 'needs a second example' });
  }

  const output = await toPromise(actor);
  log(
    output.ok
      ? `  output url: ${output.url}`
      : `  output reason: ${output.reason}`
  );
}

await run('approve');
await run('reject');

inspector?.destroy();
