import { deliverEvent, setup, type AnyActor } from '../src/index.ts';
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

describe('durable execution with only adapter runtime operations', () => {
  it('executes spawn effects without a per-effect runtime', async () => {
    const operations: string[] = [];
    const durable = createDurable(orderMachine, {
      executeAction: async (action) => {
        operations.push(`action:${action.type}`);
      },
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
      startActor: (actor) => {
        actor.start();
      },
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
      sendEvent: (_source, target, event) => {
        sent.push(`${target.address}:${event.type}`);
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
  it('serializes nested operations behind the running one', async () => {
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

    const order: string[] = [];
    let inFlight = false;
    const durable = createDurable(machine, {
      executeAction: () => {},
      // startActor initiates a nested operation without awaiting it, the way
      // a stop cascade does. Hosts with exclusive step models require that
      // nested operation to wait for this one to finish.
      startActor: async (actor) => {
        expect(inFlight).toBe(false);
        inFlight = true;
        order.push('start');
        void actor.system.scheduleTimer(actor, 'nested', 5);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('start:done');
        inFlight = false;
      },
      scheduleTimer: async (_source, id) => {
        expect(inFlight).toBe(false);
        inFlight = true;
        order.push(`timer:${id}`);
        await Promise.resolve();
        inFlight = false;
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    expect(order).toEqual(['start', 'start:done', 'timer:nested']);
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
      sendEvent: (_source, target, event) => {
        sent.push(`${(target as { address: string }).address}:${event.type}`);
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
      spawnActor: async () => {
        await Promise.resolve();
        throw new Error('host rejected the spawn');
      },
      startActor: () => {},
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
      sendEvent: (source, target, event) => {
        deliverEvent(source, target, event);
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
      spawnActor: (_source, actor) => {
        operations.push(`system-spawn:${actor.address}`);
      },
      startActor: (actor) => {
        operations.push(`system-start:${actor.address}`);
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

describe('review findings: fifth round', () => {
  it('a retried batch succeeds after a transient host operation failure', async () => {
    let attempt = 0;
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
      spawnActor: async () => {
        attempt++;
        if (attempt === 1) {
          await Promise.resolve();
          throw new Error('transient host failure');
        }
      },
      startActor: () => {},
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [, effects] = durable.initialTransition();
    await expect(durable.executeEffects(effects)).rejects.toThrow(
      'transient host failure'
    );
    // A retrying host re-executes the same effects; the previous batch's
    // failure must not be replayed.
    await expect(durable.executeEffects(effects)).resolves.toEqual([]);
  });
});

describe('review findings: sixth round', () => {
  it('root-bound events sent while the loop is parked reach the host runtime', async () => {
    const sent: string[] = [];
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
      spawnActor: () => {},
      startActor: (actor) => {
        actor.start();
      },
      sendEvent: (_source, target, event) => {
        sent.push(`${target.address}:${event.type}`);
        if (target.address !== durable.rootAddress) {
          deliverEvent(_source, target, event);
        }
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [snapshot, effects] = durable.initialTransition();
    expect(await durable.executeEffects(effects)).toEqual([]);

    // The loop is now parked. The host delivers an event to the live child,
    // whose reply is addressed to the root: it must reach the host runtime's
    // sendEvent (the host's mailbox), not the execution's capture buffer.
    const worker = (snapshot as any).children['worker:0'];
    durable.getActorRef(snapshot)!.system.runtime!.sendEvent!(
      undefined,
      worker,
      { type: 'PING' }
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent).toContain('order:WORKER.READY');

    // A later, unrelated batch must not surface that host-owned delivery.
    const [, nextEffects] = durable.transition(snapshot, {
      type: 'WORKER.READY'
    });
    expect(await durable.executeEffects(nextEffects)).toEqual([]);
  });

  it('an operation that fails while the loop is parked does not fail the next batch', async () => {
    let parked = false;
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

    const durable = createDurable(machine, {
      executeAction: () => {},
      spawnActor: () => {},
      startActor: (actor) => {
        actor.start();
      },
      sendEvent: async (source, target, event) => {
        if (parked) {
          throw new Error('host-owned delivery failed');
        }
        deliverEvent(source, target, event);
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [snapshot, effects] = durable.initialTransition();
    await durable.executeEffects(effects);

    // While parked, a host-initiated operation rejects. That failure belongs
    // to the host, which awaits its own delivery chain.
    parked = true;
    const worker = (snapshot as any).children['worker:0'];
    await expect(
      durable.getActorRef(snapshot)!.system.runtime!.sendEvent!(
        undefined,
        worker,
        { type: 'PING' }
      )
    ).rejects.toThrow('host-owned delivery failed');

    // The next batch succeeds on its own merits.
    parked = false;
    const [, kickEffects] = durable.transition(snapshot, { type: 'KICK' });
    await expect(durable.executeEffects(kickEffects)).resolves.toBeDefined();
  });
});

describe('review findings: seventh round', () => {
  it('a per-effect runtime keeps local behavior for operations neither implements', async () => {
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
      // Neither runtime implements spawnActor/startActor: adding a
      // per-effect runtime for sendEvent must not break them.
      sendEvent: () => {},
      runtime: () => ({ sendEvent: () => {} }),
      executeAction: () => {},
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [snapshot, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    const child = snapshot.children['worker:0'] as AnyActor;
    expect(child.getSnapshot().status).toBe('active');
  });
});
