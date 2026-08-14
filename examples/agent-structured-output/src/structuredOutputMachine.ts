import { setup, types, createAsyncLogic } from 'xstate';
import { z } from 'zod';

export const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

/** The shape the model is asked to produce. */
export const taskSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['low', 'high']),
  tags: z.array(z.string())
});

export type Task = z.infer<typeof taskSchema>;

const MAX_ATTEMPTS = 3;

/**
 * Mock generator. It returns a broken object on the first two attempts and a
 * valid one on the third, unless `alwaysInvalid` is set. A real implementation
 * would send `spec` plus `feedback` to the model and parse its JSON reply.
 */
const generate = createAsyncLogic({
  run: async ({
    input
  }: {
    input: {
      spec: string;
      feedback: string | null;
      attempt: number;
      alwaysInvalid: boolean;
    };
  }) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (input.feedback) {
      log(`retrying with feedback: ${input.feedback}`);
    }
    if (input.alwaysInvalid || input.attempt === 0) {
      // Missing `priority` and `tags`.
      return { raw: { title: input.spec } as unknown };
    }
    if (input.attempt === 1) {
      // `priority` outside the enum, `tags` not an array.
      return {
        raw: { title: input.spec, priority: 'urgent', tags: 'none' } as unknown
      };
    }
    return {
      raw: {
        title: input.spec,
        priority: 'high',
        tags: ['agent', 'xstate']
      } as unknown
    };
  }
});

export const structuredOutputMachine = setup({
  schemas: {
    context: types<{
      spec: string;
      alwaysInvalid: boolean;
      attempt: number;
      raw: unknown;
      task: Task | null;
      feedback: string | null;
    }>(),
    input: types<{ spec: string; alwaysInvalid?: boolean }>()
  }
}).createMachine({
  context: ({ input }) => ({
    spec: input.spec,
    alwaysInvalid: input.alwaysInvalid ?? false,
    attempt: 0,
    raw: null,
    task: null,
    feedback: null
  }),
  initial: 'generating',
  states: {
    generating: {
      entry: ({ context }, enq) =>
        enq(log, `generating (attempt ${context.attempt + 1})`),
      invoke: {
        src: generate,
        input: ({ context }) => ({
          spec: context.spec,
          feedback: context.feedback,
          attempt: context.attempt,
          alwaysInvalid: context.alwaysInvalid
        }),
        onDone: ({ event }) => ({
          target: 'validating',
          context: { raw: event.output.raw }
        })
      }
    },
    // Validation is its own state: the repair loop is a transition back to
    // `generating`, not a `while` loop around the model call.
    validating: {
      always: ({ context }, enq) => {
        const result = taskSchema.safeParse(context.raw);
        if (result.success) {
          enq(log, `valid: ${JSON.stringify(result.data)}`);
          return { target: 'succeeded', context: { task: result.data } };
        }
        const feedback = result.error.issues
          .map(
            (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
          )
          .join(', ');
        const attempt = context.attempt + 1;
        enq(log, `invalid: ${feedback}`);
        return attempt < MAX_ATTEMPTS
          ? { target: 'generating', context: { attempt, feedback } }
          : { target: 'failed', context: { attempt, feedback } };
      }
    },
    succeeded: {
      type: 'final',
      output: ({ context }) => ({
        status: 'succeeded',
        attempts: context.attempt + 1,
        task: context.task
      })
    },
    failed: {
      type: 'final',
      output: ({ context }) => ({
        status: 'failed',
        attempts: context.attempt,
        lastError: context.feedback
      })
    }
  }
});
