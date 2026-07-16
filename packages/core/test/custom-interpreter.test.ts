import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ActorSystemRuntime,
  type AnyActorLogic,
  type EventFromLogic,
  type SnapshotFrom,
  createActor,
  createMachine,
  executeEffects,
  getInitialMicrosteps,
  initialTransition,
  transition
} from '../src/index.ts';
import { createCallbackLogic } from '../src/actors/index.ts';

class Mailbox<T> {
  private active = false;
  private readonly queue: T[] = [];

  constructor(private readonly process: (item: T) => void) {}

  enqueue(item: T) {
    this.queue.push(item);
    if (this.active) {
      return;
    }

    this.active = true;
    while (this.queue.length) {
      this.process(this.queue.shift()!);
    }
    this.active = false;
  }
}

class CustomInterpreter<TLogic extends AnyActorLogic> {
  private snapshot: SnapshotFrom<TLogic>;
  private readonly runtime: Partial<ActorSystemRuntime>;
  private readonly mailbox: Mailbox<EventFromLogic<TLogic>>;

  constructor(
    private readonly logic: TLogic,
    runtime: Partial<ActorSystemRuntime> = {}
  ) {
    this.runtime = {
      sendEvent: (_source, target, event) => {
        if (!target._parent) {
          this.send(event as EventFromLogic<TLogic>);
          return;
        }
        target._send(event);
      },
      ...runtime
    };
    this.mailbox = new Mailbox((event) => {
      const [snapshot, effects] = transition(this.logic, this.snapshot, event);
      this.snapshot = snapshot;
      effects.forEach((effect) => effect.exec?.());
    });
    const [snapshot, effects] = initialTransition(logic, undefined as never, {
      runtime: this.runtime
    });
    this.snapshot = snapshot;
    effects.forEach((effect) => effect.exec?.());
  }

  send(event: EventFromLogic<TLogic>) {
    this.mailbox.enqueue(event);
  }

  getSnapshot() {
    return this.snapshot;
  }
}

describe('custom interpreter runtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('routes delayed raises back through a custom mailbox', () => {
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { after: { 10: { target: 'done' } } },
        done: {}
      }
    });
    const interpreter = new CustomInterpreter(machine);

    vi.advanceTimersByTime(10);

    expect(interpreter.getSnapshot().matches('done')).toBe(true);
  });

  it('serializes reentrant sends through the custom mailbox', () => {
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
    const interpreter = new CustomInterpreter(machine);

    interpreter.send({ type: 'START' });

    expect(interpreter.getSnapshot().matches('done')).toBe(true);
  });

  it('routes messages and completion between invoked actors and their parent', () => {
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
    const interpreter = new CustomInterpreter(machine);

    interpreter.send({ type: 'FINISH_CHILD' });

    expect(interpreter.getSnapshot().matches('success')).toBe(true);
  });

  it('delegates invoked actor lifecycle to the runtime', () => {
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
    const interpreter = new CustomInterpreter(machine, {
      createActorRef: (logic, options) => {
        operations.push(`create:${options.id}`);
        return createActor(logic, options as any);
      },
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

    interpreter.send({ type: 'EXIT' });

    expect(operations).toEqual([
      'create:child',
      'spawn:child',
      'start:child',
      'stop:child'
    ]);
  });

  it('delegates timer scheduling and cancellation to the runtime', () => {
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
    const interpreter = new CustomInterpreter(machine, {
      scheduleEvent: (_source, _target, _event, _delay, id) => {
        operations.push({ type: 'schedule', id });
      },
      cancelEvent: (_source, id) => {
        operations.push({ type: 'cancel', id });
      }
    });

    interpreter.send({ type: 'EXIT' });

    expect(operations.map(({ type }) => type)).toEqual(['schedule', 'cancel']);
    expect(operations[1].id).toBe(operations[0].id);
  });

  it('routes attached listener events through the custom mailbox', () => {
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

    const interpreter = new CustomInterpreter(machine);

    expect(interpreter.getSnapshot().matches('ready')).toBe(true);
  });

  it('uses the same runtime lifecycle for explicitly spawned actors', () => {
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
    const interpreter = new CustomInterpreter(machine, {
      createActorRef: (logic, options) => {
        operations.push(`create:${options.id}`);
        return createActor(logic, options as any);
      },
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

    interpreter.send({ type: 'STOP_CHILD' });

    expect(operations).toEqual([
      'create:child',
      'spawn:child',
      'start:child',
      'stop:child'
    ]);
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

  it('carries an attached runtime into direct machine transitions', async () => {
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
    const [initial] = initialTransition(machine);
    const [withRuntime] = transition(
      machine,
      initial,
      { type: 'UNKNOWN' },
      {
        runtime: {
          sendEvent
        }
      }
    );
    const [, effects] = machine.transition(withRuntime, { type: 'SEND' });

    await executeEffects(effects);

    expect(received).toEqual(['NOTICE']);
  });

  it('awaits runtime effects sequentially', async () => {
    const operations: string[] = [];
    const child = createCallbackLogic(() => {});
    const machine = createMachine({
      invoke: { id: 'child', src: child }
    });
    const [, effects] = initialTransition(machine, undefined, {
      runtime: {
        spawnActor: async () => {
          await Promise.resolve();
          operations.push('spawn');
        },
        startActor: (actor) => {
          operations.push('start');
          actor.start();
        }
      }
    });

    await executeEffects(effects);

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

  it('can attach a runtime when interpreting an existing snapshot', () => {
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

    const [, effects] = transition(
      machine,
      inactive,
      { type: 'START' },
      {
        runtime: {
          spawnActor: (_source, actor) => {
            operations.push(`spawn:${actor.id}`);
          },
          startActor: (actor) => {
            operations.push(`start:${actor.id}`);
          }
        }
      }
    );
    effects.forEach((effect) => effect.exec?.());

    expect(operations).toEqual(['spawn:child', 'start:child']);
  });

  it('uses an attached runtime to stop an existing child', async () => {
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
    const [, effects] = transition(
      machine,
      active,
      { type: 'EXIT' },
      {
        runtime: {
          stopActor: (actor) => {
            stopped.push(actor.id);
          }
        }
      }
    );

    await executeEffects(effects);

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
    const [snapshot] = initialTransition(machine, undefined, {
      runtime: {
        sendEvent: async (_source, _target, event) => {
          expect(sending).toBe(false);
          sending = true;
          await Promise.resolve();
          await Promise.resolve();
          operations.push(event.type);
          sending = false;
        }
      }
    });
    const [, effects] = transition(machine, snapshot, { type: 'SEND' });

    await executeEffects(effects);

    expect(operations).toEqual(['FIRST', 'SECOND']);
  });

  it('uses the runtime for effects exposed per microstep', async () => {
    const operations: string[] = [];
    const machine = createMachine({
      invoke: { id: 'child', src: createCallbackLogic(() => {}) }
    });
    const microsteps = getInitialMicrosteps(machine, undefined, {
      runtime: {
        spawnActor: (_source, actor) => {
          operations.push(`spawn:${actor.id}`);
        },
        startActor: (actor) => {
          operations.push(`start:${actor.id}`);
        }
      }
    });

    for (const [, effects] of microsteps) {
      await executeEffects(effects);
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
    const [snapshot] = initialTransition(machine, undefined, {
      runtime: {
        emitEvent: (_source, event) => {
          emitted.push(event.type);
        }
      }
    });
    const [, effects] = transition(machine, snapshot, { type: 'EMIT' });

    await executeEffects(effects);

    expect(emitted).toEqual(['NOTICE']);
  });
});
