import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ActorSystemRuntime,
  type AnyActorLogic,
  type EventFromLogic,
  type ExecutableActionObject,
  createActor,
  createMachine,
  executeEffects,
  getInitialMicrosteps,
  initialTransition,
  transition
} from '../src/index.ts';
import { createCallbackLogic } from '../src/actors/index.ts';

class CustomInterpreter<TLogic extends AnyActorLogic> {
  private readonly queue: EventFromLogic<TLogic>[] = [];
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly runtime: Partial<ActorSystemRuntime>;

  constructor(runtime: Partial<ActorSystemRuntime> = {}) {
    this.runtime = {
      sendEvent: (_source, target, event) => {
        if (!target._parent) {
          this.enqueue(event as EventFromLogic<TLogic>);
          return;
        }
        target._send(event);
      },
      scheduleTimer: (source, id, delay) => {
        const timeout = setTimeout(() => {
          void this.runtime.sendEvent?.(source, source, {
            type: 'xstate.timer',
            id
          });
        }, delay);
        this.timers.set(`${source.sessionId}.${id}`, timeout);
      },
      cancelTimer: (source, id) => {
        clearTimeout(this.timers.get(`${source.sessionId}.${id}`));
      },
      // When this example delegates child execution back to `createActor`, the
      // child's system must use the same runtime operations as this mailbox.
      spawnActor: (_source, actor) => {
        Object.assign(actor.system, this.runtime);
      },
      startActor: (actor) => {
        actor.start();
      },
      stopActor: (actor) => {
        (actor as any)._stop();
      },
      ...runtime
    };
  }

  async executeEffects(
    effects: Parameters<typeof executeEffects>[0]
  ): Promise<void> {
    for (const effect of effects) {
      await effect.exec(this.runtime);
    }
  }

  enqueue(event: EventFromLogic<TLogic>): void {
    this.queue.push(event);
  }

  dequeue(): EventFromLogic<TLogic> | undefined {
    return this.queue.shift();
  }

  hasEvents(): boolean {
    return this.queue.length > 0;
  }
}

describe('custom interpreter runtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('routes delayed raises back through a custom mailbox', async () => {
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 10: { target: 'done' } } },
        done: {}
      }
    });
    const interpreter = new CustomInterpreter<typeof machine>();
    let [state, effects] = machine.initialTransition(undefined);
    expect(
      effects.every(
        (effect: ExecutableActionObject) => typeof effect.exec === 'function'
      )
    ).toBe(true);
    await interpreter.executeEffects(effects);

    vi.advanceTimersByTime(10);
    while (interpreter.hasEvents()) {
      [state, effects] = machine.transition(state, interpreter.dequeue()!);
      await interpreter.executeEffects(effects);
    }

    expect(state.matches('done')).toBe(true);
  });

  it('keeps custom actions and arguments explicit', async () => {
    const action = vi.fn();
    const machine = createMachine({
      entry: (_, enq) => enq(action, { value: 42 })
    });

    const [, effects] = machine.initialTransition(undefined);
    const [effect] = effects;

    expect(effect).toMatchObject({
      kind: 'action',
      action,
      args: [{ value: 42 }],
      exec: expect.any(Function)
    });

    await effect.exec();
    expect(action).toHaveBeenCalledWith({ value: 42 });
  });

  it('serializes reentrant sends in a caller-owned transition loop', async () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            START: ({ self }, enq) => {
              enq.sendTo(self, { type: 'CONTINUE' });
              return { target: 'second' };
            }
          }
        },
        second: { on: { CONTINUE: { target: 'done' } } },
        done: {}
      }
    });
    const interpreter = new CustomInterpreter<typeof machine>();
    let [state, effects] = machine.initialTransition(undefined);
    await interpreter.executeEffects(effects);
    interpreter.enqueue({ type: 'START' });

    while (state.status === 'active' && interpreter.hasEvents()) {
      [state, effects] = machine.transition(state, interpreter.dequeue()!);
      await interpreter.executeEffects(effects);
    }

    expect(state.matches('done')).toBe(true);
  });

  it('routes messages and completion between invoked actors and their parent', async () => {
    const child = createMachine({
      initial: 'waiting',
      states: {
        waiting: { on: { FINISH: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'child',
            src: child,
            onDone: { target: 'success' }
          },
          on: {
            FINISH_CHILD: ({ children }, enq) =>
              enq.sendTo(children.child, { type: 'FINISH' })
          }
        },
        success: {}
      }
    });
    const interpreter = new CustomInterpreter<typeof machine>();
    let [state, effects] = machine.initialTransition(undefined);
    await interpreter.executeEffects(effects);
    interpreter.enqueue({ type: 'FINISH_CHILD' });

    while (state.status === 'active' && interpreter.hasEvents()) {
      [state, effects] = machine.transition(state, interpreter.dequeue()!);
      await interpreter.executeEffects(effects);
    }

    expect(state.matches('success')).toBe(true);
  });

  it('delivers delayed sends through the source timer input', async () => {
    const child = createMachine({
      initial: 'waiting',
      states: {
        waiting: { on: { PING: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const machine = createMachine({
      actorSources: { child },
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'child',
            src: 'child',
            onDone: { target: 'success' }
          },
          on: {
            SEND: ({ children }, enq) => {
              enq.sendTo(
                children.child,
                { type: 'PING' },
                {
                  id: 'ping',
                  delay: 10
                }
              );
            }
          }
        },
        success: {}
      }
    });
    const interpreter = new CustomInterpreter<typeof machine>();
    let [state, effects] = machine.initialTransition(undefined);
    await interpreter.executeEffects(effects);
    interpreter.enqueue({ type: 'SEND' });

    while (interpreter.hasEvents()) {
      [state, effects] = machine.transition(state, interpreter.dequeue()!);
      await interpreter.executeEffects(effects);
    }
    vi.advanceTimersByTime(10);
    while (interpreter.hasEvents()) {
      [state, effects] = machine.transition(state, interpreter.dequeue()!);
      await interpreter.executeEffects(effects);
    }

    expect(state.matches('success')).toBe(true);
  });

  it('delegates invoked actor lifecycle to the runtime', async () => {
    const operations: string[] = [];
    const child = createMachine({});
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'child', src: child },
          on: { EXIT: { target: 'inactive' } }
        },
        inactive: {}
      }
    });
    const interpreter = new CustomInterpreter<typeof machine>({
      spawnActor: (_source, actor) => {
        operations.push(`spawn:${actor.id}`);
      },
      startActor: (actor) => {
        operations.push(`start:${actor.id}`);
        actor.start();
      },
      stopActor: (actor) => {
        operations.push(`stop:${actor.id}`);
        (actor as any)._stop();
      }
    });
    let [state, effects] = machine.initialTransition(undefined);
    await interpreter.executeEffects(effects);
    interpreter.enqueue({ type: 'EXIT' });
    while (interpreter.hasEvents()) {
      [state, effects] = machine.transition(state, interpreter.dequeue()!);
      await interpreter.executeEffects(effects);
    }

    expect(operations).toEqual(['spawn:child', 'start:child', 'stop:child']);
  });

  it('delegates timer scheduling and cancellation to the runtime', async () => {
    const operations: Array<{ type: string; id: string | undefined }> = [];
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          after: { 1000: { target: 'timedOut' } },
          on: { EXIT: { target: 'exited' } }
        },
        timedOut: {},
        exited: {}
      }
    });
    const interpreter = new CustomInterpreter<typeof machine>({
      scheduleTimer: (_source, id) => {
        operations.push({ type: 'schedule', id });
      },
      cancelTimer: (_source, id) => {
        operations.push({ type: 'cancel', id });
      }
    });
    let [state, effects] = machine.initialTransition(undefined);
    await interpreter.executeEffects(effects);
    interpreter.enqueue({ type: 'EXIT' });
    while (interpreter.hasEvents()) {
      [state, effects] = machine.transition(state, interpreter.dequeue()!);
      await interpreter.executeEffects(effects);
    }

    expect(operations.map(({ type }) => type)).toEqual(['schedule', 'cancel']);
    expect(operations[1].id).toBe(operations[0].id);
  });

  it('routes attached listener events through the custom mailbox', async () => {
    const child = createCallbackLogic(({ emit }) => {
      emit({ type: 'READY' });
    });
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          invoke: { id: 'child', src: child },
          entry: ({ children }, enq) => {
            enq.listen(children.child!, 'READY', () => ({
              type: 'CHILD_READY'
            }));
          },
          on: { CHILD_READY: { target: 'ready' } }
        },
        ready: {}
      }
    });

    const interpreter = new CustomInterpreter<typeof machine>();
    let [state, effects] = machine.initialTransition(undefined);
    await interpreter.executeEffects(effects);
    while (interpreter.hasEvents()) {
      [state, effects] = machine.transition(state, interpreter.dequeue()!);
      await interpreter.executeEffects(effects);
    }

    expect(state.matches('ready')).toBe(true);
  });

  it('uses the same runtime lifecycle for explicitly spawned actors', async () => {
    const operations: string[] = [];
    const child = createCallbackLogic(() => {});
    const machine = createMachine({
      entry: (_, enq) => {
        enq.spawn(child, { id: 'child' });
      },
      on: {
        STOP_CHILD: ({ children }, enq) => enq.stop(children.child)
      }
    });
    const interpreter = new CustomInterpreter<typeof machine>({
      spawnActor: (_source, actor) => {
        operations.push(`spawn:${actor.id}`);
      },
      startActor: (actor) => {
        operations.push(`start:${actor.id}`);
        actor.start();
      },
      stopActor: (actor) => {
        operations.push(`stop:${actor.id}`);
        (actor as any)._stop();
      }
    });
    let [state, effects] = machine.initialTransition(undefined);
    await interpreter.executeEffects(effects);
    interpreter.enqueue({ type: 'STOP_CHILD' });
    while (interpreter.hasEvents()) {
      [state, effects] = machine.transition(state, interpreter.dequeue()!);
      await interpreter.executeEffects(effects);
    }

    expect(operations).toEqual(['spawn:child', 'start:child', 'stop:child']);
  });

  it('needs no actor scope for machine transition methods', async () => {
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { on: { NEXT: { target: 'done' } } },
        done: {}
      }
    });
    const [waiting] = machine.initialTransition(undefined);
    const [done, effects] = machine.transition(waiting, { type: 'NEXT' });

    await executeEffects(effects);
    expect(done.matches('done')).toBe(true);
  });

  it('selects the runtime when executing effects', async () => {
    const received: string[] = [];
    const sendEvent: NonNullable<ActorSystemRuntime['sendEvent']> = (
      _source,
      _target,
      event
    ) => {
      received.push(event.type);
    };
    const machine = createMachine({
      on: {
        SEND: ({ self }, enq) => enq.sendTo(self, { type: 'NOTICE' })
      }
    });
    const [initial] = machine.initialTransition(undefined);
    const [, effects] = machine.transition(initial, { type: 'SEND' });

    await executeEffects(effects, { sendEvent });

    expect(received).toEqual(['NOTICE']);
  });

  it('invokes runtime operations with the runtime as this', async () => {
    const runtime: Partial<ActorSystemRuntime> & { received: string[] } = {
      received: [],
      sendEvent(_source, _target, event) {
        this.received.push(event.type);
      }
    };
    const machine = createMachine({
      on: {
        SEND: ({ self }, enq) => enq.sendTo(self, { type: 'NOTICE' })
      }
    });
    const [initial] = machine.initialTransition(undefined);
    const [, effects] = machine.transition(initial, { type: 'SEND' });

    await effects[0].exec(runtime);

    expect(runtime.received).toEqual(['NOTICE']);
  });

  it('awaits runtime effects sequentially', async () => {
    const operations: string[] = [];
    const child = createCallbackLogic(() => {});
    const machine = createMachine({
      invoke: { id: 'child', src: child }
    });
    const [, effects] = machine.initialTransition(undefined);

    await executeEffects(effects, {
      spawnActor: async () => {
        await Promise.resolve();
        operations.push('spawn');
      },
      startActor: (actor) => {
        operations.push('start');
        actor.start();
      }
    });

    expect(operations).toEqual(['spawn', 'start']);
  });

  it('uses the same runtime contract in createActor', () => {
    const child = createCallbackLogic(() => {});
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'child', src: child },
          on: { EXIT: { target: 'inactive' } }
        },
        inactive: {}
      }
    });
    const actor = createActor(machine);
    const spawnActor = vi.spyOn(actor.system, 'spawnActor');
    const startActor = vi.spyOn(actor.system, 'startActor');
    const stopActor = vi.spyOn(actor.system, 'stopActor');

    actor.start();
    actor.send({ type: 'EXIT' });

    expect(spawnActor).toHaveBeenCalledOnce();
    expect(startActor).toHaveBeenCalledOnce();
    expect(stopActor).toHaveBeenCalledOnce();
  });

  it('can execute an existing snapshot transition with another runtime', async () => {
    const operations: string[] = [];
    const child = createCallbackLogic(() => {});
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: { on: { START: { target: 'active' } } },
        active: { invoke: { id: 'child', src: child } }
      }
    });
    const [inactive] = initialTransition(machine);

    const [, effects] = transition(machine, inactive, { type: 'START' });
    await executeEffects(effects, {
      spawnActor: (_source, actor) => {
        operations.push(`spawn:${actor.id}`);
      },
      startActor: (actor) => {
        operations.push(`start:${actor.id}`);
      }
    });

    expect(operations).toEqual(['spawn:child', 'start:child']);
  });

  it('uses the execution runtime to stop an existing child', async () => {
    const stopped: string[] = [];
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'child', src: createCallbackLogic(() => {}) },
          on: { EXIT: { target: 'inactive' } }
        },
        inactive: {}
      }
    });
    const [active] = initialTransition(machine);
    const [, effects] = transition(machine, active, { type: 'EXIT' });

    await executeEffects(effects, {
      stopActor: (actor) => {
        stopped.push(actor.id);
      }
    });

    expect(stopped).toEqual(['child']);
  });

  it('awaits asynchronous sends before executing the next effect', async () => {
    const operations: string[] = [];
    let sending = false;
    const machine = createMachine({
      on: {
        SEND: ({ self }, enq) => {
          enq.sendTo(self, { type: 'FIRST' });
          enq.sendTo(self, { type: 'SECOND' });
        }
      }
    });
    const [snapshot] = machine.initialTransition(undefined);
    const [, effects] = transition(machine, snapshot, { type: 'SEND' });

    await executeEffects(effects, {
      sendEvent: async (_source, _target, event) => {
        expect(sending).toBe(false);
        sending = true;
        await Promise.resolve();
        await Promise.resolve();
        operations.push(event.type);
        sending = false;
      }
    });

    expect(operations).toEqual(['FIRST', 'SECOND']);
  });

  it('uses the runtime for effects exposed per microstep', async () => {
    const operations: string[] = [];
    const machine = createMachine({
      invoke: { id: 'child', src: createCallbackLogic(() => {}) }
    });
    const microsteps = getInitialMicrosteps(machine);
    const runtime: Partial<ActorSystemRuntime> = {
      spawnActor: (_source, actor) => {
        operations.push(`spawn:${actor.id}`);
      },
      startActor: (actor) => {
        operations.push(`start:${actor.id}`);
      }
    };

    for (const [, effects] of microsteps) {
      await executeEffects(effects, runtime);
    }

    expect(operations).toEqual(['spawn:child', 'start:child']);
  });

  it('delegates emitted events to the runtime', async () => {
    const emitted: string[] = [];
    const machine = createMachine({
      on: {
        EMIT: (_, enq) => enq.emit({ type: 'NOTICE' })
      }
    });
    const [snapshot] = machine.initialTransition(undefined);
    const [, effects] = transition(machine, snapshot, { type: 'EMIT' });

    await executeEffects(effects, {
      emitEvent: (_source, event) => {
        emitted.push(event.type);
      }
    });

    expect(emitted).toEqual(['NOTICE']);
  });
});
