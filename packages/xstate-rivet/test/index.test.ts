import { createMachine, setup as setupXState } from 'xstate';
import { createRivetDurable } from '../src/index.ts';

describe('@xstate/rivet', () => {
  it('runs actions as workflow steps and receives events from an actor queue', async () => {
    const calls: number[] = [];
    const stepNames: string[] = [];
    const messages = [{ body: { event: { type: 'FINISH' } } }];
    const machine = setupXState({
      actions: {
        record: (params: { value: number }) => {
          calls.push(params.value);
        }
      }
    }).createMachine({
      output: 'complete',
      initial: 'active',
      entry: ({ actions }, enq) => enq(actions.record, { value: 1 }),
      states: {
        active: {
          on: {
            FINISH: ({ actions }, enq) => {
              enq(actions.record, { value: 2 });
              return { target: 'done' };
            }
          }
        },
        done: { type: 'final' }
      }
    });
    const context = {
      async step<T>(name: string, run: (context: unknown) => Promise<T>) {
        stepNames.push(name);
        return run({});
      },
      queue: {
        async next(name: string) {
          expect(name).toBe('machine-events');
          return messages.shift();
        }
      }
    };

    await expect(
      createRivetDurable(machine, {
        context,
        queue: 'machine-events'
      }).run(undefined)
    ).resolves.toBe('complete');
    expect(calls).toEqual([1, 2]);
    expect(stepNames).toEqual(['0:0', '1:0', '1:1']);
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
    const durable = createRivetDurable(machine, {
      context: {
        async step<T>(_name: string, run: (_context: unknown) => Promise<T>) {
          return run({});
        },
        queue: { next: vi.fn() }
      },
      queue: 'machine-events',
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
});
