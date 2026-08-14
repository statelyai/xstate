import { createActor, setup, toPromise, types } from 'xstate';
// Actor creators are imported from the `xstate/actors` subpath so that this
// example runs under `tsx` against the workspace build.
import { createAsyncLogic } from 'xstate/actors';

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

// v5: fromPromise(async ({ input }) => …)
const submitFeedback = createAsyncLogic({
  run: async ({ input }: { input: { rating: number; comment: string } }) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { id: `fb-${input.rating}` };
  }
});

export const feedbackMachine = setup({
  // v5: types: {} as { context: …; events: … }
  schemas: {
    context: types<{
      rating: number;
      comment: string;
      id: string | null;
    }>(),
    events: {
      rate: types<{ rating: number }>(),
      comment: types<{ comment: string }>(),
      submit: types<{}>()
    }
  },
  actors: { submitFeedback },
  guards: {
    isComplete: ({
      context
    }: {
      context: { rating: number; comment: string };
    }) => context.rating > 0 && context.comment.trim().length > 0
  }
}).createMachine({
  context: { rating: 0, comment: '', id: null },
  initial: 'editing',
  states: {
    editing: {
      on: {
        // v5: actions: assign({ rating: ({ event }) => event.rating })
        rate: ({ event }) => ({ context: { rating: event.rating } }),
        comment: ({ event }) => ({ context: { comment: event.comment } }),
        // v5: { guard: 'isComplete', target: 'submitting' }
        submit: ({ context, guards }) =>
          guards.isComplete({ context }) ? { target: 'submitting' } : undefined
      }
    },
    submitting: {
      invoke: {
        src: ({ actors }) => actors.submitFeedback,
        input: ({ context }) => ({
          rating: context.rating,
          comment: context.comment
        }),
        // v5: onDone: { target: 'submitted', actions: assign(…) }
        onDone: ({ event }, enq) => {
          enq(log, `submitted as ${event.output.id}`);
          return { target: 'submitted', context: { id: event.output.id } };
        },
        onError: () => ({ target: 'editing' })
      }
    },
    submitted: {
      type: 'final',
      output: ({ context }) => ({ id: context.id })
    }
  }
});

const actor = createActor(feedbackMachine);

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

actor.send({ type: 'submit' }); // ignored: the draft is incomplete
actor.send({ type: 'rate', rating: 5 });
actor.send({ type: 'comment', comment: 'Migrating was fine' });
actor.send({ type: 'submit' });

log(`result: ${JSON.stringify(await toPromise(actor))}`);
