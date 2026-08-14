import { setup, types } from 'xstate';
// Actor creators are imported from the `xstate/actors` subpath so that this
// example runs under `tsx` against the workspace build.
import { createCallbackLogic } from 'xstate/actors';

export const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const CHUNKS = ['State ', 'machines ', 'make ', 'streaming ', 'boring.'];

/**
 * Mock token stream. A real implementation would iterate the SDK's streaming
 * response and `sendBack` one `chunk` event per token; the cleanup function
 * returned below is where the underlying request is aborted, and it runs
 * whenever the machine leaves the `streaming` state.
 */
const streamTokens = createCallbackLogic({
  run: ({
    input,
    sendBack
  }: {
    input: { prompt: string; failAfter: number | null };
    sendBack: (event: { type: string; text?: string }) => void;
  }) => {
    let index = 0;
    let stopped = false;

    const timer = setInterval(() => {
      if (stopped) {
        return;
      }
      if (input.failAfter !== null && index === input.failAfter) {
        stopped = true;
        sendBack({ type: 'streamError' });
        return;
      }
      if (index >= CHUNKS.length) {
        stopped = true;
        sendBack({ type: 'streamDone' });
        return;
      }
      sendBack({ type: 'chunk', text: CHUNKS[index++] });
    }, 120);

    return () => {
      stopped = true;
      clearInterval(timer);
      log(`stream for "${input.prompt}" torn down`);
    };
  }
});

export const streamingMachine = setup({
  schemas: {
    context: types<{
      prompt: string;
      failAfter: number | null;
      text: string;
      attempts: number;
    }>(),
    events: {
      chunk: types<{ text: string }>(),
      streamDone: types<{}>(),
      streamError: types<{}>(),
      cancel: types<{}>()
    },
    input: types<{ prompt: string; failAfter: number | null }>()
  },
  delays: { retryBackoff: 150 }
}).createMachine({
  context: ({ input }) => ({
    prompt: input.prompt,
    failAfter: input.failAfter,
    text: '',
    attempts: 0
  }),
  initial: 'streaming',
  states: {
    streaming: {
      entry: ({ context }, enq) =>
        enq(log, `requesting completion for "${context.prompt}"`),
      invoke: {
        src: streamTokens,
        input: ({ context }) => ({
          prompt: context.prompt,
          // Only the first attempt fails; the retry streams to completion.
          failAfter: context.attempts === 0 ? context.failAfter : null
        })
      },
      on: {
        chunk: ({ context, event }, enq) => {
          const text = context.text + event.text;
          enq(
            log,
            `chunk: ${JSON.stringify(event.text)} (${text.length} chars)`
          );
          return { context: { text } };
        },
        streamDone: { target: 'done' },
        // One retry. Leaving `streaming` stops the callback actor, which runs
        // its cleanup and aborts the underlying request.
        streamError: ({ context }, enq) => {
          enq(log, `stream failed after ${context.text.length} chars`);
          return context.attempts === 0
            ? {
                target: 'retrying',
                context: { attempts: context.attempts + 1, text: '' }
              }
            : { target: 'failed' };
        },
        cancel: ({ context }, enq) => {
          enq(log, `cancelled with ${context.text.length} chars buffered`);
          return { target: 'cancelled' };
        }
      }
    },
    retrying: {
      entry: (_, enq) => enq(log, 'retrying once'),
      after: { retryBackoff: { target: 'streaming' } },
      on: { cancel: { target: 'cancelled' } }
    },
    done: {
      type: 'final',
      output: ({ context }) => ({
        status: 'done',
        attempts: context.attempts + 1,
        text: context.text
      })
    },
    cancelled: {
      type: 'final',
      output: ({ context }) => ({
        status: 'cancelled',
        attempts: context.attempts + 1,
        text: context.text
      })
    },
    failed: {
      type: 'final',
      output: ({ context }) => ({
        status: 'failed',
        attempts: context.attempts + 1,
        text: context.text
      })
    }
  }
});
