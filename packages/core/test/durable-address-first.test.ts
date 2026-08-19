import { deliverEvent, setup } from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';

const workerMachine = setup({}).createMachine({
  id: 'worker',
  initial: 'idle',
  states: {
    idle: {
      on: {
        PING: ({ parent }, enq) => {
          enq.sendTo(parent, { type: 'WORKER.READY' });
          return { target: 'ready' };
        }
      }
    },
    ready: {}
  }
});

const orderMachine = setup({
  actors: { worker: workerMachine }
}).createMachine({
  id: 'order',
  initial: 'starting',
  entry: ({ actors }, enq) => {
    enq.spawn(actors.worker);
  },
  states: {
    starting: {
      on: {
        KICK: ({ children }, enq) => {
          enq.sendTo(children['worker:0'], { type: 'PING' });
        },
        'WORKER.READY': { target: 'done' }
      }
    },
    done: { type: 'final' }
  }
});

describe('durable execution with only systemRuntime', () => {
  it('executes spawn effects without a per-effect runtime', async () => {
    const operations: string[] = [];
    const durable = createDurable(orderMachine, {
      executeAction: async (action) => {
        operations.push(`action:${action.type}`);
      },
      systemRuntime: {
        spawnActor: (_source, actor) => {
          operations.push(`spawn:${actor.address}`);
        },
        startActor: (actor) => {
          operations.push(`start:${actor.address}`);
          actor.start();
        },
        sendEvent: (source, target, event) => {
          operations.push(
            `send:${source?.address}->${target.address}:${event.type}`
          );
          deliverEvent(source, target, event);
        }
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    let [snapshot, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    expect(operations).toEqual([
      'spawn:order/worker:0',
      'start:order/worker:0'
    ]);

    [snapshot, effects] = durable.transition(snapshot, { type: 'KICK' });
    const rootEvents = await durable.executeEffects(effects);
    // The child's reply was produced with no per-actor wiring, captured by
    // the execution instead of reaching the host's sendEvent, and returned
    // with its source for the durable loop.
    expect(operations).toContain('send:order->order/worker:0:PING');
    expect(operations).not.toContain('send:order/worker:0->order:WORKER.READY');
    expect(rootEvents).toEqual([
      { event: { type: 'WORKER.READY' }, source: expect.anything() }
    ]);
    expect(rootEvents[0]!.source?.address).toBe('order/worker:0');

    [snapshot] = durable.transition(snapshot, rootEvents[0]!.event);
    expect(snapshot.status).toBe('done');
  });
});

describe('durable effect descriptors', () => {
  it('tags every effect with a JSON-safe descriptor', () => {
    const durable = createDurable(orderMachine, {
      executeAction: () => {},
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [, effects] = durable.initialTransition();
    for (const { descriptor } of effects) {
      expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor);
    }
    expect(effects.map(({ descriptor }) => descriptor.type)).toEqual([
      '@xstate.spawn',
      '@xstate.start'
    ]);
    const spawn = effects.find(
      ({ descriptor }) => descriptor.type === '@xstate.spawn'
    )!.descriptor;
    expect(spawn).toMatchObject({
      actor: 'order/worker:0',
      src: 'worker'
    });
  });
});

describe('durable rootAddress', () => {
  it('is the logic name, known before any transition', () => {
    const durable = createDurable(orderMachine, {
      executeAction: () => {},
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });
    expect(durable.rootAddress).toBe('order');
    const [snapshot] = durable.initialTransition();
    expect(durable.getActorRef(snapshot)?.address).toBe(durable.rootAddress);
  });
});

describe('restored children under a durable execution', () => {
  it('routes sends to restored remote handles through the system runtime', async () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker);
      },
      states: {
        a: {
          on: {
            KICK: ({ children }, enq) => {
              enq.sendTo(children['worker:0'], { type: 'PING' });
            }
          }
        }
      }
    });

    // Persist by address on one placement...
    const seed = createDurable(machine, {
      executeAction: () => {},
      systemRuntime: {},
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });
    const [seedSnapshot, seedEffects] = seed.initialTransition();
    await seed.executeEffects(seedEffects);
    const persisted = machine.getPersistedSnapshot(seedSnapshot, {
      embedChildren: false
    } as never);

    // ...and resume on another, where the child is a remote handle.
    const sent: string[] = [];
    const durable = createDurable(machine, {
      executeAction: () => {},
      systemRuntime: {
        sendEvent: (_source, target, event) => {
          sent.push(`${target.address}:${event.type}`);
        }
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });
    const restored = machine.restoreSnapshot(persisted as never);
    const [, effects] = durable.transition(restored as never, {
      type: 'KICK'
    });
    await durable.executeEffects(effects);
    expect(sent).toEqual(['order/worker:0:PING']);
  });
});

describe('review findings: durable runtime edges', () => {
  it('does not deadlock when a runtime operation awaits a nested operation', async () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker);
      },
      states: {
        a: {
          on: {
            KICK: ({ children }, enq) => {
              enq.sendTo(children['worker:0'], { type: 'PING' });
            }
          }
        }
      }
    });

    const operations: string[] = [];
    const durable = createDurable(machine, {
      executeAction: () => {},
      systemRuntime: {
        sendEvent: async (source, target, event) => {
          // Awaiting a nested runtime operation must not deadlock the tail.
          await target.system.scheduleTimer(target, 'nested', 5);
          operations.push(`send:${target.address}:${event.type}`);
          deliverEvent(source, target, event);
        },
        scheduleTimer: (_source, id) => {
          operations.push(`timer:${id}`);
        }
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    let [snapshot, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    [snapshot, effects] = durable.transition(snapshot, { type: 'KICK' });
    await durable.executeEffects(effects);
    expect(operations).toEqual(['timer:nested', 'send:order/worker:0:PING']);
  }, 2000);

  it('hands custom actions the system runtime when no per-effect runtime exists', async () => {
    const sent: string[] = [];
    const machine = setup({
      actions: {
        notify: () => {}
      }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actions }, enq) => {
        enq(actions.notify);
      },
      states: { a: {} }
    });

    const durable = createDurable(machine, {
      executeAction: async (_action, _metadata, runtime) => {
        expect(typeof runtime.sendEvent).toBe('function');
        await runtime.sendEvent!(undefined, { address: 'elsewhere' } as never, {
          type: 'X'
        });
      },
      systemRuntime: {
        sendEvent: (_source, target, event) => {
          sent.push(`${(target as { address: string }).address}:${event.type}`);
        }
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    expect(sent).toEqual(['elsewhere:X']);
  });
});

describe('review findings: fourth round', () => {
  it('a failed runtime operation rejects executeEffects even after settling early', async () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker);
      },
      states: { a: {} }
    });

    const durable = createDurable(machine, {
      executeAction: () => {},
      systemRuntime: {
        spawnActor: async () => {
          await Promise.resolve();
          throw new Error('host rejected the spawn');
        },
        startActor: () => {}
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [, effects] = durable.initialTransition();
    // Give the rejection time to settle (and leave the pending set) before
    // executeEffects awaits it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(durable.executeEffects(effects)).rejects.toThrow(
      'host rejected the spawn'
    );
  });

  it('failed batches do not leak captured root events into later calls', async () => {
    const machine = setup({
      actors: { worker: workerMachine },
      actions: { boom: () => {} }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors, actions }, enq) => {
        enq.spawn(actors.worker);
        enq(actions.boom);
      },
      states: {
        a: {
          on: {
            KICK: ({ children }, enq) => {
              enq.sendTo(children['worker:0'], { type: 'PING' });
            }
          }
        }
      }
    });

    const durable = createDurable(machine, {
      executeAction: (action) => {
        if (action.type === 'boom') {
          throw new Error('step failed');
        }
      },
      systemRuntime: {
        sendEvent: (source, target, event) => {
          deliverEvent(source, target, event);
        }
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [snapshot, effects] = durable.initialTransition();
    await expect(durable.executeEffects(effects)).rejects.toThrow(
      'step failed'
    );
    // The child's WORKER-bound reply (none here) and any captured root events
    // from the failed batch are gone; a fresh batch starts clean.
    const [, kickEffects] = durable.transition(snapshot, { type: 'KICK' });
    const rootEvents = await durable.executeEffects(kickEffects);
    expect(rootEvents).toEqual([]);
  });

  it('a per-effect runtime falls back to the system runtime for omitted operations', async () => {
    const operations: string[] = [];
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker);
      },
      states: { a: {} }
    });

    const durable = createDurable(machine, {
      executeAction: () => {},
      systemRuntime: {
        spawnActor: (_source, actor) => {
          operations.push(`system-spawn:${actor.address}`);
        },
        startActor: (actor) => {
          operations.push(`system-start:${actor.address}`);
        }
      },
      // The per-effect runtime implements only sendEvent; spawn/start must
      // keep the system runtime's behavior.
      runtime: () => ({
        sendEvent: () => {}
      }),
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    expect(operations).toEqual([
      'system-spawn:order/worker:0',
      'system-start:order/worker:0'
    ]);
  });
});
