import { InngestTestEngine } from '@inngest/test';
import { Inngest } from 'inngest';
import { createMachine, setup } from 'xstate';
import {
  InngestEventWaitTimeoutError,
  createInngestDurable
} from '../src/index.ts';

describe('@xstate/inngest', () => {
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
      states: {
        done: { type: 'final' }
      }
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

  it('resumes the transition loop with the received event', async () => {
    const calls: string[] = [];
    const machine = createMachine({
      output: 'complete',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: (_, enq) => {
              enq(() => {
                calls.push('finished');
              });
              return { target: 'done' };
            }
          }
        },
        done: { type: 'final' }
      }
    });
    const events = [
      { name: 'machine/event', data: { event: { type: 'FINISH' } } }
    ];
    const durable = createInngestDurable(machine, {
      step: {
        async run(_id: unknown, fn: () => unknown) {
          return fn();
        },
        async waitForEvent() {
          return events.shift();
        }
      } as never,
      event: 'machine/event',
      timeout: '1 day'
    });

    await expect(durable.run(undefined)).resolves.toBe('complete');
    expect(calls).toEqual(['finished']);
  });

  it('exposes the full built-in effect to runtime mappings', async () => {
    const effects: unknown[] = [];
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 10: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const step = {
      run: vi.fn(async (_id: unknown, fn: () => unknown) => fn()),
      waitForEvent: vi.fn()
    };
    const durable = createInngestDurable(machine, {
      step: step as never,
      event: 'machine/event',
      timeout: '1 day',
      runtime: (_metadata, effect) => {
        effects.push(effect);
        return { scheduleTimer: vi.fn() };
      }
    });
    const [, initialEffects] = durable.initialTransition(undefined);

    await durable.executeEffects(initialEffects);

    expect(effects).toEqual([
      expect.objectContaining({ type: '@xstate.raise', delay: 10 })
    ]);
  });

  it('reports an expired wait explicitly', async () => {
    const machine = createMachine({});
    const durable = createInngestDurable(machine, {
      step: {
        run: vi.fn(),
        waitForEvent: vi.fn().mockResolvedValue(null)
      } as never,
      event: 'machine/event',
      timeout: '1 second'
    });

    durable.initialTransition(undefined);
    await expect(durable.waitForEvent()).rejects.toEqual(
      new InngestEventWaitTimeoutError('event:0')
    );
  });
});
