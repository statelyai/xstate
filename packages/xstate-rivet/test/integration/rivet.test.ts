import { actor, queue, setup } from 'rivetkit';
import { setupTest } from 'rivetkit/test';
import { workflow } from 'rivetkit/workflow';
import { createMachine } from 'xstate';
import { createRivetDurable } from '../../src/index.ts';

const machine = createMachine({
  output: 'complete',
  initial: 'active',
  states: {
    active: { on: { FINISH: { target: 'done' } } },
    done: { type: 'final' }
  }
});

const endpoint = process.env.XSTATE_RIVET_TEST_ENDPOINT;

it.skipIf(!endpoint)(
  "runs inside Rivet's actor workflow test runtime",
  async (testContext) => {
    const durableActor = actor({
      state: { output: undefined as string | undefined },
      queues: {
        events: queue<{ event: { type: 'FINISH' } }>()
      },
      run: workflow(async (context) => {
        const output = (await createRivetDurable(machine, {
          context,
          queue: 'events'
        }).run(undefined)) as string;
        await context.step('store-output', async (step) => {
          step.state.output = output;
        });
      }),
      actions: {
        getOutput: (context) => context.state.output
      }
    });
    const registry = setup({
      use: { durableActor },
      endpoint,
      startEngine: false,
      shutdown: { gracePeriodMs: 1_000, disableSignalHandlers: true }
    });
    const { client } = await setupTest(testContext, registry);

    try {
      const handle = client.durableActor.getOrCreate(['test']);
      await handle.send('events', { event: { type: 'FINISH' } });
      await expect.poll(() => handle.getOutput()).toBe('complete');
    } finally {
      await registry.shutdown();
    }
  },
  10_000
);
