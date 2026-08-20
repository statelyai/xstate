import {
  createLogic,
  createMachine,
  setup as setupXState
} from '../../src/index.ts';
import {
  createDurable,
  type DurableExecutionAdapter
} from '../../src/durable/index.ts';
import type { AnyActorLogic, EventFromLogic } from '../../src/types.ts';

interface RivetWorkflowContext {
  step(name: string, run: () => unknown | Promise<unknown>): Promise<unknown>;
  queue: {
    next(name: string, options: { names: readonly string[] }): Promise<unknown>;
  };
}

function createRivetPoc<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: {
    context: RivetWorkflowContext;
    queue: string;
    runtime?: DurableExecutionAdapter<TLogic>['runtime'];
  }
) {
  return createDurable(logic, {
    async executeAction(action, metadata, runtime) {
      await options.context.step(metadata.id, async () => action.exec(runtime));
    },
    runtime(metadata, effect) {
      const runtime = options.runtime?.(metadata, effect) ?? {};
      if (
        effect.type !== '@xstate.terminate' ||
        runtime.terminateActor !== undefined
      ) {
        return runtime;
      }

      // This bounded-workflow PoC only supports root completion.
      return {
        ...runtime,
        async terminateActor() {
          await options.context.step(metadata.id, async () => {});
        }
      };
    },
    async waitForEvent(metadata) {
      const message = await options.context.queue.next(metadata.id, {
        names: [options.queue]
      });
      return (message as { body: { event: EventFromLogic<TLogic> } }).body
        .event;
    }
  });
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
        async next(name: string, options: { names: readonly string[] }) {
          expect(name).toBe('event:0');
          expect(options).toEqual({ names: ['machine-events'] });
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

  it('exposes built-in effects to host runtime mappings', async () => {
    const effects: unknown[] = [];
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 10: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const durable = createRivetPoc(machine, {
      context: {
        async step(_name: string, run: () => unknown | Promise<unknown>) {
          return run();
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

  it('forwards the host runtime to custom effects', async () => {
    const runtime = { sendEvent: vi.fn() };
    let providedRuntime: unknown;
    const logic = createLogic({
      context: undefined,
      run: ({ event }, enq) => {
        if (event.type === '@xstate.init') {
          enq.effect((effectRuntime) => {
            providedRuntime = effectRuntime;
          });
        }
      }
    });
    const durable = createRivetPoc(logic, {
      context: {
        async step(_name: string, run: () => unknown | Promise<unknown>) {
          return run();
        },
        queue: { next: vi.fn() }
      },
      queue: 'machine-events',
      runtime: () => runtime
    });
    const [, effects] = durable.initialTransition(undefined);

    await durable.executeEffects(effects);

    const target = { address: 'elsewhere' } as never;
    const event = { type: 'X' };
    await (
      providedRuntime as { sendEvent(...args: unknown[]): PromiseLike<void> }
    ).sendEvent(undefined, target, event);
    expect(runtime.sendEvent).toHaveBeenCalledWith(undefined, target, event);
  });
});
