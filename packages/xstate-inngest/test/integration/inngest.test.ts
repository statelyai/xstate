import { InngestTestEngine } from '@inngest/test';
import { Inngest } from 'inngest';
import { createMachine, setup } from 'xstate';
import { createInngestDurable } from '../../src/index.ts';

describe('@xstate/inngest SDK integration', () => {
  it('runs actions and output as native Inngest steps', async () => {
    const calls: number[] = [];
    const machine = setup({
      actions: {
        record: (params: { value: number }) => {
          calls.push(params.value);
        }
      }
    }).createMachine({
      output: 'complete',
      initial: 'done',
      entry: ({ actions }, enq) => enq(actions.record, { value: 1 }),
      states: { done: { type: 'final' } }
    });
    const inngest = new Inngest({ id: 'xstate-test' });
    const fn = inngest.createFunction(
      { id: 'xstate-durable', triggers: { event: 'machine/start' } },
      async ({ step }) =>
        createInngestDurable(machine, {
          step,
          event: 'machine/event',
          timeout: '1 day'
        }).run(undefined)
    );
    const engine = new InngestTestEngine({ function: fn });

    const { ctx, result } = await engine.execute({
      events: [{ name: 'machine/start', data: {} }],
      steps: []
    });

    expect(result).toBe('complete');
    expect(calls).toEqual([1]);
    expect(ctx.step.run).toHaveBeenNthCalledWith(
      1,
      '0:0',
      expect.any(Function)
    );
    expect(ctx.step.run).toHaveBeenNthCalledWith(
      2,
      '0:1',
      expect.any(Function)
    );
  });

  it('registers event waits as native Inngest steps', async () => {
    const machine = createMachine({});
    const inngest = new Inngest({ id: 'xstate-wait-test' });
    const fn = inngest.createFunction(
      { id: 'xstate-wait', triggers: { event: 'machine/start' } },
      async ({ step }) =>
        createInngestDurable(machine, {
          step,
          event: 'machine/event',
          timeout: '1 day'
        }).run(undefined)
    );
    const engine = new InngestTestEngine({ function: fn });

    const { ctx, step } = await engine.executeStep('event:0', {
      events: [{ name: 'machine/start', data: {} }]
    });

    expect(step.name).toBe('machine/event');
    expect(ctx.step.waitForEvent).toHaveBeenCalledWith('event:0', {
      event: 'machine/event',
      timeout: '1 day'
    });
  });
});
