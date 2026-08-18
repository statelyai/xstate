import { createLogic, createMachine } from '../../src/index.ts';
import {
  createDurable,
  type DurableExecutionAdapter
} from '../../src/durable/index.ts';
import type { AnyActorLogic, EventFromLogic } from '../../src/types.ts';

interface InngestStepTools {
  run(id: string, run: () => unknown | Promise<unknown>): Promise<unknown>;
  waitForEvent(
    id: string,
    options: { event: string; timeout: string }
  ): Promise<unknown | null>;
}

function createInngestPoc<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: {
    step: InngestStepTools;
    event: string;
    timeout: string;
    runtime?: DurableExecutionAdapter<TLogic>['runtime'];
  }
) {
  return createDurable(logic, {
    async executeAction(action, metadata, runtime) {
      await options.step.run(metadata.id, async () => action.exec(runtime));
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
          await options.step.run(metadata.id, async () => {});
        }
      };
    },
    async waitForEvent(metadata) {
      const received = await options.step.waitForEvent(metadata.id, {
        event: options.event,
        timeout: options.timeout
      });
      if (received === null) {
        throw new Error(`Timed out waiting in step "${metadata.id}"`);
      }
      return (received as { data: { event: EventFromLogic<TLogic> } }).data
        .event;
    }
  });
}

describe('Inngest durable execution PoC', () => {
  it('runs actions as steps and resumes from an event wait', async () => {
    const calls: string[] = [];
    const machine = createMachine({
      output: 'complete',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: (_, enq) => {
              enq(() => calls.push('finished'));
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
      run: vi.fn(async (_id: string, run: () => unknown) => run()),
      waitForEvent: vi.fn(async () => events.shift() ?? null)
    };

    await expect(
      createInngestPoc(machine, {
        step,
        event: 'machine/event',
        timeout: '1 day'
      }).run(undefined)
    ).resolves.toBe('complete');

    expect(calls).toEqual(['finished']);
    expect(step.waitForEvent).toHaveBeenCalledWith('event:0', {
      event: 'machine/event',
      timeout: '1 day'
    });
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
    const durable = createInngestPoc(machine, {
      step: {
        run: vi.fn(async (_id: string, run: () => unknown) => run()),
        waitForEvent: vi.fn()
      },
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
    const durable = createInngestPoc(logic, {
      step: {
        run: vi.fn(async (_id: string, run: () => unknown) => run()),
        waitForEvent: vi.fn()
      },
      event: 'machine/event',
      timeout: '1 day',
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

  it('reports an expired wait explicitly', async () => {
    const durable = createInngestPoc(createMachine({}), {
      step: {
        run: vi.fn(),
        waitForEvent: vi.fn().mockResolvedValue(null)
      },
      event: 'machine/event',
      timeout: '1 second'
    });

    durable.initialTransition(undefined);
    await expect(durable.waitForEvent()).rejects.toThrow(
      'Timed out waiting in step "event:0"'
    );
  });
});
