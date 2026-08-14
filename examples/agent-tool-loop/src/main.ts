import { createActor, setup, toPromise, types } from 'xstate';
// Actor creators are imported from the `xstate/actors` subpath so that this
// example runs under `tsx` against the workspace build.
import { createAsyncLogic } from 'xstate/actors';

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type ToolName = 'search' | 'calculator' | 'weather';

interface ToolCall {
  name: ToolName;
  args: string;
}

type ModelReply =
  | { kind: 'tool'; call: ToolCall; thought: string }
  | { kind: 'final'; answer: string };

const MAX_ITERATIONS = 5;

/**
 * A mock model. It "reasons" only from the number of observations it has seen
 * so far, so the run is deterministic and offline.
 */
const model = createAsyncLogic({
  run: async ({
    input
  }: {
    input: { goal: string; observations: string[] };
  }): Promise<ModelReply> => {
    await wait(150);
    const step = input.observations.length;
    if (step === 0) {
      return {
        kind: 'tool',
        thought: 'I need the population of the city first.',
        call: { name: 'search', args: 'population of Lisbon' }
      };
    }
    if (step === 1) {
      return {
        kind: 'tool',
        thought: 'Now I can compute the per-capita figure.',
        call: { name: 'calculator', args: '548703 / 100' }
      };
    }
    if (step === 2) {
      return {
        kind: 'tool',
        thought: 'The user also asked about conditions today.',
        call: { name: 'weather', args: 'Lisbon' }
      };
    }
    return {
      kind: 'final',
      answer: `${input.goal} -> ${input.observations.join(' | ')}`
    };
  }
});

const tool = (name: ToolName, run: (args: string) => string) =>
  createAsyncLogic({
    run: async ({ input }: { input: { args: string } }) => {
      log(`tool ${name}(${input.args})`);
      await wait(100);
      return { observation: `${name}: ${run(input.args)}` };
    }
  });

const search = tool(
  'search',
  (args) => `Lisbon has 548,703 residents (${args})`
);
const calculator = tool('calculator', () => '5487.03');
const weather = tool('weather', (args) => `18C and clear in ${args}`);

const toolTarget = {
  search: 'calling_search',
  calculator: 'calling_calculator',
  weather: 'calling_weather'
} as const;

const agent = setup({
  schemas: {
    context: types<{
      goal: string;
      observations: string[];
      iterations: number;
      pending: ToolCall | null;
      answer: string | null;
    }>(),
    input: types<{ goal: string }>()
  },
  guards: {
    underLimit: ({ context }: { context: { iterations: number } }) =>
      context.iterations < MAX_ITERATIONS
  }
}).createMachine({
  context: ({ input }) => ({
    goal: input.goal,
    observations: [],
    iterations: 0,
    pending: null,
    answer: null
  }),
  initial: 'thinking',
  states: {
    // The model decides: call a tool, or answer. Every loop through this state
    // counts against the iteration budget.
    thinking: {
      invoke: {
        src: model,
        input: ({ context }) => ({
          goal: context.goal,
          observations: context.observations
        }),
        onDone: ({ context, event, guards }, enq) => {
          const iterations = context.iterations + 1;
          const reply: ModelReply = event.output;
          if (reply.kind === 'final') {
            enq(log, 'model returned a final answer');
            return {
              target: 'answered',
              context: { iterations, answer: reply.answer }
            };
          }
          if (!guards.underLimit({ context: { iterations } })) {
            return { target: 'stopped', context: { iterations } };
          }
          enq(log, `model thought: ${reply.thought}`);
          return {
            target: toolTarget[reply.call.name],
            context: { iterations, pending: reply.call }
          };
        }
      }
    },
    // One state per tool, so the statechart shows which tool is in flight
    // instead of hiding the dispatch inside a function.
    calling_search: {
      invoke: {
        src: search,
        input: ({ context }) => ({ args: context.pending!.args }),
        onDone: ({ context, event }) => ({
          target: 'observing',
          context: {
            pending: null,
            observations: [...context.observations, event.output.observation]
          }
        })
      }
    },
    calling_calculator: {
      invoke: {
        src: calculator,
        input: ({ context }) => ({ args: context.pending!.args }),
        onDone: ({ context, event }) => ({
          target: 'observing',
          context: {
            pending: null,
            observations: [...context.observations, event.output.observation]
          }
        })
      }
    },
    calling_weather: {
      invoke: {
        src: weather,
        input: ({ context }) => ({ args: context.pending!.args }),
        onDone: ({ context, event }) => ({
          target: 'observing',
          context: {
            pending: null,
            observations: [...context.observations, event.output.observation]
          }
        })
      }
    },
    observing: {
      entry: ({ context }, enq) =>
        enq(log, `observed: ${context.observations.at(-1)}`),
      always: { target: 'thinking' }
    },
    answered: {
      type: 'final',
      output: ({ context }) => ({
        answer: context.answer,
        iterations: context.iterations
      })
    },
    stopped: {
      type: 'final',
      output: ({ context }) => ({
        answer: null,
        stoppedAt: context.iterations,
        reason: 'max iterations reached'
      })
    }
  }
});

const actor = createActor(agent, {
  input: { goal: 'Brief me on Lisbon' }
});

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

log(`result: ${JSON.stringify(await toPromise(actor), null, 2)}`);
