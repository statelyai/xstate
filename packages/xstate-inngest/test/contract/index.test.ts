import { createMachine } from 'xstate';
import {
  InngestEventWaitTimeoutError,
  createInngestDurable
} from '../../src/index.ts';

describe('@xstate/inngest context contract', () => {
  it('runs actions and resumes the transition loop', async () => {
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
    const step = {
      run: vi.fn(async (_id: unknown, fn: () => unknown) => fn()),
      waitForEvent: vi.fn(async () => events.shift())
    };
    const durable = createInngestDurable(machine, {
      step: step as never,
      event: 'machine/event',
      timeout: '1 day'
    });

    await expect(durable.run(undefined)).resolves.toBe('complete');
    expect(calls).toEqual(['finished']);
    expect(step.waitForEvent).toHaveBeenCalledOnce();
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
    const durable = createInngestDurable(machine, {
      step: {
        run: vi.fn(async (_id: unknown, fn: () => unknown) => fn()),
        waitForEvent: vi.fn()
      } as never,
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
