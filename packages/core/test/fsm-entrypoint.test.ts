import * as fsm from '../src/fsm/index.ts';
import { createFSM, createFSMActor } from '../src/fsm/index.ts';
import { createActor as createFullActor } from '../src/createActor.ts';
import { createCallbackLogic } from '../src/actors/callback.ts';
import type { AnyActor } from '../src/types.ts';

describe('xstate/fsm', () => {
  it('only exports the explicitly specialized actor creator', () => {
    expect(fsm.createFSMActor).toBe(createFSMActor);
    expect(fsm).not.toHaveProperty('createActor');
  });

  it('creates and runs a flat state machine actor', () => {
    const logic = createFSM({
      initial: 'inactive',
      states: {
        inactive: {
          on: { toggle: { target: 'active' } }
        },
        active: {
          on: { toggle: { target: 'inactive' } }
        }
      }
    });
    const actor = createFSMActor(logic).start();
    ((_: AnyActor) => {})(actor);

    actor.send({ type: 'toggle' });

    expect(actor.getSnapshot().value).toBe('active');
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)(
    'preserves queued and reentrant event ordering in the %s actor',
    (_, create) => {
      const logic = createFSM({
        initial: 'inactive',
        states: {
          inactive: { on: { toggle: { target: 'active' } } },
          active: { on: { toggle: { target: 'inactive' } } }
        }
      });
      const actor = create(logic);
      const values: string[] = [];

      actor.send({ type: 'toggle' });
      actor.subscribe((snapshot) => {
        values.push(snapshot.value);
        if (values.length === 2) {
          actor.send({ type: 'toggle' });
        }
      });
      actor.start();

      expect(values).toEqual(['inactive', 'active', 'inactive']);
    }
  );

  it('stops the specialized actor from an action while events remain queued', () => {
    let stopRoot = () => {};
    const logic = createFSM({
      initial: 'active',
      states: {
        active: {
          on: {
            stop: (_, enq) => {
              enq.raise({ type: 'queued' });
              enq(stopRoot);
            },
            queued: {}
          }
        }
      }
    });
    const actor = createFSMActor(logic).start();
    stopRoot = () => actor.stop();

    expect(() => actor.send({ type: 'stop' })).not.toThrow();
    expect(actor.getSnapshot().status).toBe('stopped');
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('persists and restores the %s actor snapshot', (_, create) => {
    const logic = createFSM({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            increment: {
              context: ({ context }) => ({ count: context.count + 1 })
            }
          }
        }
      }
    });
    const actor = create(logic).start();
    actor.send({ type: 'increment' });

    const restored = create(logic, {
      snapshot: actor.getPersistedSnapshot()
    }).start();

    expect(restored.getSnapshot()).toMatchObject({
      status: 'active',
      value: 'idle',
      context: { count: 1 }
    });
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('stops and completes observers in the %s actor', (_, create) => {
    const logic = createFSM({ initial: 'idle', states: { idle: {} } });
    const snapshots: string[] = [];
    let completed = 0;
    const actor = create(logic);
    actor.subscribe({
      next: (snapshot) => snapshots.push(snapshot.status),
      complete: () => completed++
    });

    actor.start().stop();

    expect(actor.getSnapshot().status).toBe('stopped');
    expect(snapshots).toEqual(['active']);
    expect(completed).toBe(1);
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('stops child actors with the %s parent', (_, create) => {
    let stopped = 0;
    const child = createCallbackLogic(() => () => stopped++);
    const logic = createFSM({
      initial: 'active',
      states: {
        active: {
          entry: (_, enq) => {
            enq.spawn(child);
          }
        }
      }
    });
    const actor = create(logic).start();

    actor.stop();

    expect(stopped).toBe(1);
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)(
    'executes actions and emitted events in the %s actor',
    (_, create) => {
      const calls: string[] = [];
      const logic = createFSM({
        initial: 'idle',
        states: {
          idle: {
            entry: (_, enq) => enq(() => calls.push('entry')),
            on: {
              run: (_, enq) => {
                enq(() => calls.push('action'));
                enq.emit({ type: 'notice' });
              }
            }
          }
        }
      });
      const actor = create(logic);
      actor.on('notice', () => calls.push('emit'));

      actor.start();
      actor.send({ type: 'run' });

      expect(calls).toEqual(['entry', 'action', 'emit']);
    }
  );

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('runs delayed raises through the %s actor clock', (_, create) => {
    let task: (() => void) | undefined;
    const clock = {
      setTimeout(fn: () => void) {
        task = fn;
        return 1;
      },
      clearTimeout() {}
    };
    const logic = createFSM({
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            schedule: (_, enq) => {
              enq.raise({ type: 'elapsed' }, { delay: 10 });
            },
            elapsed: { target: 'ready' }
          }
        },
        ready: {}
      }
    });
    const actor = create(logic, { clock }).start();

    actor.send({ type: 'schedule' });
    expect(actor.getSnapshot().value).toBe('waiting');
    task?.();

    expect(actor.getSnapshot().value).toBe('ready');
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('restores pending timers in the %s actor', (_, create) => {
    let restoredTask: (() => void) | undefined;
    const logic = createFSM({
      initial: 'waiting',
      states: {
        waiting: {
          on: {
            schedule: (_, enq) => {
              enq.raise({ type: 'elapsed' }, { id: 'wake', delay: 10 });
            },
            elapsed: { target: 'ready' }
          }
        },
        ready: {}
      }
    });
    const source = create(logic, {
      clock: { setTimeout: () => 1, clearTimeout() {} }
    }).start();
    source.send({ type: 'schedule' });
    const restored = create(logic, {
      snapshot: source.getPersistedSnapshot(),
      clock: {
        setTimeout(fn: () => void) {
          restoredTask = fn;
          return 2;
        },
        clearTimeout() {}
      }
    }).start();

    expect(restoredTask).toBeTypeOf('function');
    restoredTask?.();
    expect(restored.getSnapshot().value).toBe('ready');
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('spawns and starts children in the %s actor', (_, create) => {
    let starts = 0;
    const child = createCallbackLogic(() => {
      starts++;
    });
    const logic = createFSM({
      initial: 'idle',
      states: {
        idle: {
          entry: (_, enq) => {
            enq.spawn(child, { id: 'child' });
          }
        }
      }
    });

    const actor = create(logic).start();

    expect(Object.keys(actor.getSnapshot().children)).toEqual(['child']);
    expect(starts).toBe(1);
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)(
    'attaches listeners before child startup in the %s actor',
    (_, create) => {
      const received: string[] = [];
      const child = createCallbackLogic(({ emit }) => {
        emit({ type: 'ready' });
      });
      const logic = createFSM({
        initial: 'idle',
        states: {
          idle: {
            entry: (_, enq) => {
              const childRef = enq.spawn(child, { id: 'child' });
              enq.listen(childRef, 'ready', () => ({ type: 'childReady' }));
            },
            on: {
              childReady: ({ event }, enq) => {
                enq(() => received.push(event.type));
              }
            }
          }
        }
      });

      create(logic).start();

      expect(received).toEqual(['childReady']);
    }
  );

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('completes final states in the %s actor', (_, create) => {
    const logic = createFSM({
      initial: 'active',
      states: {
        active: { on: { finish: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    let completed = 0;
    const actor = create(logic);
    actor.subscribe({ complete: () => completed++ });

    actor.start();
    actor.send({ type: 'finish' });

    expect(actor.getSnapshot()).toMatchObject({
      status: 'done',
      value: 'done'
    });
    expect(completed).toBe(1);
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)(
    'stabilizes eventless transitions in the %s actor',
    (_, create) => {
      const logic = createFSM({
        initial: 'checking',
        context: { ready: true },
        states: {
          checking: {
            always: {
              guard: ({ context }) => context.ready,
              target: 'ready'
            }
          },
          ready: {}
        }
      });

      const actor = create(logic).start();

      expect(actor.getSnapshot().value).toBe('ready');
    }
  );

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('reports execution errors in the %s actor', (_, create) => {
    const failure = new Error('failed');
    const logic = createFSM({
      initial: 'active',
      states: {
        active: {
          on: {
            fail: (_, enq) => {
              enq(() => {
                throw failure;
              });
            }
          }
        }
      }
    });
    const errors: unknown[] = [];
    const actor = create(logic);
    actor.subscribe({ error: (error) => errors.push(error) });
    actor.start();

    actor.send({ type: 'fail' });

    expect(actor.getSnapshot()).toMatchObject({
      status: 'error',
      error: failure
    });
    expect(errors).toEqual([failure]);
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('reports initialization errors in the %s actor', (_, create) => {
    const failure = new Error('initialization failed');
    const logic = createFSM({
      initial: 'active',
      context: () => {
        throw failure;
      },
      states: { active: {} }
    });
    const actor = create(logic);
    const errors: unknown[] = [];
    actor.subscribe({ error: (error) => errors.push(error) });

    actor.start();

    expect(actor.getSnapshot()).toMatchObject({
      status: 'error',
      error: failure
    });
    expect(errors).toEqual([failure]);
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('preserves actor identity in the %s actor', (_, create) => {
    const logic = createFSM({
      id: 'light',
      initial: 'active',
      states: { active: {} }
    });
    const first = create(logic);
    const second = create(logic);

    expect(first.id).toBe('light');
    expect(first.address).toBe('light');
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.toJSON?.()).toMatchObject({
      xstate$type: 'actorRef',
      id: 'light',
      address: 'light'
    });
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)(
    'prevents directly stopping children in the %s actor',
    (_, create) => {
      const childLogic = createCallbackLogic(() => {});
      const logic = createFSM({
        initial: 'active',
        states: {
          active: {
            entry: (_, enq) => {
              enq.spawn(childLogic, { id: 'child' });
            }
          }
        }
      });
      const actor = create(logic).start();
      const child = (actor.getSnapshot().children as any).child;

      expect(() => child.stop()).toThrow('non-root actor');
    }
  );

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)('completes late subscribers to a done %s actor', (_, create) => {
    const actor = create(
      createFSM({ initial: 'done', states: { done: { type: 'final' } } })
    ).start();
    let completed = 0;

    actor.subscribe({ complete: () => completed++ });

    expect(completed).toBe(1);
  });

  it.each([
    ['specialized', createFSMActor],
    ['full', createFullActor]
  ] as const)(
    'registers spawned actors in the %s actor system',
    (_, create) => {
      const childLogic = createCallbackLogic(() => {});
      const logic = createFSM({
        initial: 'active',
        states: {
          active: {
            entry: (_, enq) => {
              enq.spawn(childLogic, { registryKey: 'worker' } as any);
            }
          }
        }
      });
      const actor = create(logic).start();

      expect(actor.system.get('worker')).toBe(
        Object.values(actor.getSnapshot().children)[0]
      );
    }
  );
});
