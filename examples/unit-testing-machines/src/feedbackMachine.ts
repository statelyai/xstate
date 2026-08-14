import { setup, types } from 'xstate';
// Actor creators are imported from the `xstate/actors` subpath so that this
// example runs against the workspace build.
import { createAsyncLogic } from 'xstate/actors';

export interface Feedback {
  rating: number;
  comment: string;
}

/**
 * The real implementation. Tests never call it: they swap it out with
 * `machine.provide({ actors: { submitFeedback: … } })`.
 */
export const submitFeedback = createAsyncLogic({
  run: async ({ input }: { input: Feedback }) => {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return { id: String(response.status) };
  }
});

export const RETRY_DELAY = 3000;

export const feedbackMachine = setup({
  schemas: {
    context: types<{
      rating: number;
      comment: string;
      id: string | null;
      error: string | null;
    }>(),
    events: {
      rate: types<{ rating: number }>(),
      comment: types<{ comment: string }>(),
      submit: types<{}>(),
      retry: types<{}>()
    }
  },
  actors: { submitFeedback },
  guards: {
    isComplete: ({
      context
    }: {
      context: { rating: number; comment: string };
    }) => context.rating > 0 && context.comment.trim().length > 0
  },
  delays: { retryAfter: RETRY_DELAY }
}).createMachine({
  context: { rating: 0, comment: '', id: null, error: null },
  initial: 'editing',
  states: {
    editing: {
      on: {
        rate: ({ event }) => ({ context: { rating: event.rating } }),
        comment: ({ event }) => ({ context: { comment: event.comment } }),
        // A transition function replaces the v5 `guard` key: return a target
        // when the transition should be taken, and nothing when it should not.
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
        onDone: ({ event }) => ({
          target: 'submitted',
          context: { id: event.output.id }
        }),
        onError: ({ event }) => ({
          target: 'failed',
          context: { error: (event.error as Error).message }
        })
      }
    },
    // The retry is a delayed transition, so tests can drive it with a
    // `SimulatedClock` instead of waiting three real seconds.
    failed: {
      after: { retryAfter: { target: 'submitting' } },
      on: {
        retry: { target: 'submitting' }
      }
    },
    submitted: {
      type: 'final',
      output: ({ context }) => ({ id: context.id })
    }
  }
});
