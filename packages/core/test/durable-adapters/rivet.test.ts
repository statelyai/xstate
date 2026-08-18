import { createMachine, setup as setupXState } from '../../src/index.ts';
import {
  createDurableSystem,
  DurableExecutionCancelledError,
  type DurableSystemEffect
} from '../../src/durable/index.ts';
import type {
  AnyStateMachine,
  EventFromLogic,
  InputFrom,
  OutputFrom,
  Snapshot
} from '../../src/types.ts';

interface RivetWorkflowContext {
  step(name: string, run: () => unknown | Promise<unknown>): Promise<unknown>;
  queue: {
    next(name: string, options: { names: readonly string[] }): Promise<unknown>;
  };
}

function createRivetPoc<TLogic extends AnyStateMachine>(
  logic: TLogic,
  options: {
    context: RivetWorkflowContext;
    queue: string;
    executeEffect?(effect: DurableSystemEffect): void | PromiseLike<void>;
  }
) {
  const durable = createDurableSystem(logic);

  const executeEffects = (effects: readonly DurableSystemEffect[]) =>
    durable.executeEffects(effects, {
      execute: async (effect, executeAction) => {
        await options.context.step(effect.id, async () => {
          if (executeAction) {
            await executeAction();
          } else {
            await options.executeEffect?.(effect);
          }
        });
      }
    });

  return {
    durable,
    executeEffects,
    async run(
      ...[input]: undefined extends InputFrom<TLogic>
        ? [input?: InputFrom<TLogic>]
        : [input: InputFrom<TLogic>]
    ): Promise<OutputFrom<TLogic>> {
      let result = durable.initialTransition(input as never);
      await executeEffects(result.effects);

      while ((result.state.snapshot as Snapshot<unknown>).status === 'active') {
        const waitId = `event:${result.state.nextTransitionIndex - 1}`;
        const message = await options.context.queue.next(waitId, {
          names: [options.queue]
        });
        result = durable.transition(
          result.state,
          (message as { body: { event: EventFromLogic<TLogic> } }).body.event
        );
        await executeEffects(result.effects);
      }

      const snapshot = result.state.snapshot as Snapshot<OutputFrom<TLogic>>;
      if (snapshot.status === 'done') {
        return snapshot.output;
      }
      if (snapshot.status === 'error') {
        throw snapshot.error;
      }
      throw new DurableExecutionCancelledError();
    }
  };
}

describe('Rivet durable execution PoC', () => {
  it('runs actions as workflow steps and receives queue events', async () => {
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
      async step(name: string, run: () => unknown | Promise<unknown>) {
        stepNames.push(name);
        return run();
      },
      queue: {
        async next(name: string, queueOptions: { names: readonly string[] }) {
          expect(name).toBe('event:0');
          expect(queueOptions).toEqual({ names: ['machine-events'] });
          return messages.shift();
        }
      }
    };

    await expect(
      createRivetPoc(machine, {
        context,
        queue: 'machine-events'
      }).run(undefined)
    ).resolves.toBe('complete');

    expect(calls).toEqual([1, 2]);
    expect(stepNames).toEqual(['0:0', '1:0', '1:1']);
  });

  it('receives serializable logical timer effects', async () => {
    const effects: DurableSystemEffect[] = [];
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 10: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const poc = createRivetPoc(machine, {
      context: {
        async step(_name: string, run: () => unknown | Promise<unknown>) {
          return run();
        },
        queue: { next: vi.fn() }
      },
      queue: 'machine-events',
      executeEffect: (effect) => {
        effects.push(effect);
      }
    });
    const initial = poc.durable.initialTransition(undefined);

    await poc.executeEffects(initial.effects);

    expect(effects).toEqual([
      expect.objectContaining({
        type: 'timer.schedule',
        delay: 10,
        source: { id: 'root:0', actorId: 'root' },
        target: { id: 'root:0', actorId: 'root' }
      })
    ]);
    expect(() => JSON.stringify(effects)).not.toThrow();
  });
});
