import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type ProviderName = 'primary' | 'secondary' | 'tertiary';

/**
 * A mock provider call. `primary` always errors, `secondary` times out once
 * and then answers, `tertiary` is never reached in this scripted run.
 */
const complete = createAsyncLogic({
  run: async ({
    input
  }: {
    input: { provider: ProviderName; attempt: number; prompt: string };
  }) => {
    log(`${input.provider}: request (attempt ${input.attempt})`);
    await wait(120);
    if (input.provider === 'primary') {
      throw new Error('503 upstream overloaded');
    }
    if (input.provider === 'secondary' && input.attempt === 1) {
      throw new Error('timeout after 120ms');
    }
    return { text: `${input.provider} answered: ${input.prompt}` };
  }
});

const MAX_ATTEMPTS = 2;

/**
 * One provider, with its own bounded retry-and-backoff budget. It always
 * reaches a final state, so the caller never has to catch anything: it reads
 * `ok` from the output and decides whether to fail over.
 */
const provider = setup({
  schemas: {
    context: types<{
      provider: ProviderName;
      prompt: string;
      attempt: number;
      text: string | null;
      error: string | null;
    }>(),
    input: types<{ provider: ProviderName; prompt: string }>(),
    output: types<{
      ok: boolean;
      provider: ProviderName;
      text: string | null;
      error: string | null;
    }>()
  },
  guards: {
    canRetry: ({ context }: { context: { attempt: number } }) =>
      context.attempt < MAX_ATTEMPTS
  },
  delays: {
    backoff: ({ context }: { context: { attempt: number } }) =>
      100 * 2 ** (context.attempt - 1)
  },
  actors: { complete }
}).createMachine({
  context: ({ input }) => ({
    provider: input.provider,
    prompt: input.prompt,
    attempt: 0,
    text: null,
    error: null
  }),
  initial: 'calling',
  states: {
    calling: {
      invoke: {
        src: 'complete',
        input: ({ context }) => ({
          provider: context.provider,
          attempt: context.attempt + 1,
          prompt: context.prompt
        }),
        onDone: ({ context, event }) => ({
          target: 'answered',
          context: { attempt: context.attempt + 1, text: event.output.text }
        }),
        onError: ({ context, event, guards }, enq) => {
          const attempt = context.attempt + 1;
          const error = (event.error as Error).message;
          enq(log, `${context.provider}: attempt ${attempt} failed (${error})`);
          return guards.canRetry({ context: { attempt } })
            ? { target: 'backingOff', context: { attempt, error } }
            : { target: 'exhausted', context: { attempt, error } };
        }
      }
    },
    backingOff: {
      after: { backoff: { target: 'calling' } }
    },
    answered: {
      type: 'final',
      output: ({ context }) => ({
        ok: true,
        provider: context.provider,
        text: context.text,
        error: null
      })
    },
    exhausted: {
      type: 'final',
      output: ({ context }) => ({
        ok: false,
        provider: context.provider,
        text: null,
        error: context.error
      })
    }
  }
});

const router = setup({
  schemas: {
    context: types<{
      prompt: string;
      tried: ProviderName[];
      text: string | null;
      servedBy: ProviderName | null;
    }>(),
    input: types<{ prompt: string }>()
  },
  actors: { provider }
}).createMachine({
  context: ({ input }) => ({
    prompt: input.prompt,
    tried: [],
    text: null,
    servedBy: null
  }),
  initial: 'usingPrimary',
  states: {
    // Each provider is a state. Failing over is a transition, so the fallback
    // order is visible in the chart instead of buried in a try/catch chain.
    usingPrimary: {
      invoke: {
        src: 'provider',
        input: ({ context }) => ({
          provider: 'primary' as const,
          prompt: context.prompt
        }),
        onDone: ({ context, event }, enq) => {
          const tried = [...context.tried, 'primary' as const];
          if (event.output.ok) {
            return {
              target: 'served',
              context: { tried, text: event.output.text, servedBy: 'primary' }
            };
          }
          enq(log, 'primary exhausted; failing over to secondary');
          return { target: 'usingSecondary', context: { tried } };
        }
      }
    },
    usingSecondary: {
      invoke: {
        src: 'provider',
        input: ({ context }) => ({
          provider: 'secondary' as const,
          prompt: context.prompt
        }),
        onDone: ({ context, event }, enq) => {
          const tried = [...context.tried, 'secondary' as const];
          if (event.output.ok) {
            return {
              target: 'served',
              context: {
                tried,
                text: event.output.text,
                servedBy: 'secondary'
              }
            };
          }
          enq(log, 'secondary exhausted; failing over to tertiary');
          return { target: 'usingTertiary', context: { tried } };
        }
      }
    },
    usingTertiary: {
      invoke: {
        src: 'provider',
        input: ({ context }) => ({
          provider: 'tertiary' as const,
          prompt: context.prompt
        }),
        onDone: ({ context, event }) => {
          const tried = [...context.tried, 'tertiary' as const];
          return event.output.ok
            ? {
                target: 'served',
                context: {
                  tried,
                  text: event.output.text,
                  servedBy: 'tertiary'
                }
              }
            : { target: 'circuitOpen', context: { tried } };
        }
      }
    },
    served: {
      type: 'final',
      output: ({ context }) => ({
        servedBy: context.servedBy,
        text: context.text,
        tried: context.tried
      })
    },
    // Every provider is down. The circuit stays open instead of hammering
    // them; a supervisor would restart this actor after a cooldown.
    circuitOpen: {
      entry: (_, enq) => enq(log, 'all providers down: circuit open'),
      type: 'final',
      output: ({ context }) => ({
        servedBy: null,
        text: null,
        tried: context.tried
      })
    }
  }
});

const actor = createActor(router, {
  input: { prompt: 'summarize the incident report' },
  inspect: inspector?.inspect
});

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

log(`result: ${JSON.stringify(await toPromise(actor), null, 2)}`);

inspector?.destroy();
