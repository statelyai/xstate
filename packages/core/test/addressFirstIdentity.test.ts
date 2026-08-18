import {
  createActor,
  createMachine,
  getEffectDescriptor,
  initialTransition,
  setup,
  transition,
  type AnyActor
} from '../src';

const workerMachine = createMachine({
  id: 'worker',
  initial: 'idle',
  states: {
    idle: {
      on: { PING: { target: 'pinged' } }
    },
    pinged: {}
  }
});

describe('deterministic actor ids', () => {
  it('root actors are named after their logic', () => {
    const machine = createMachine({
      id: 'order',
      initial: 'a',
      states: { a: {} }
    });
    const actor = createActor(machine).start();
    expect(actor.id).toBe('order');
    expect(actor.address).toBe('order');
  });

  it('generated child ids are src-keyed counters', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker);
        enq.spawn(actors.worker);
        enq.spawn(actors.worker, { id: 'named' });
      },
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    expect(Object.keys(actor.getSnapshot().children).sort()).toEqual([
      'named',
      'worker:0',
      'worker:1'
    ]);
  });

  it('generated ids are identical across pure replays', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker);
        enq.spawn(actors.worker);
      },
      states: { a: {} }
    });

    const [first] = initialTransition(machine);
    const [second] = initialTransition(machine);
    expect(Object.keys(first.children)).toEqual(['worker:0', 'worker:1']);
    expect(Object.keys(second.children)).toEqual(['worker:0', 'worker:1']);
  });

  it('restore reserves generated ids so later spawns do not collide', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker);
        enq.spawn(actors.worker);
      },
      states: {
        a: {
          on: {
            MORE: ({ actors }, enq) => {
              enq.spawn(actors.worker);
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const restored = createActor(machine, { snapshot: persisted }).start();
    restored.send({ type: 'MORE' });
    expect(Object.keys(restored.getSnapshot().children).sort()).toEqual([
      'worker:0',
      'worker:1',
      'worker:2'
    ]);
  });
});

describe('actor addresses', () => {
  it('addresses are the /-joined id path from the root', () => {
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

    const actor = createActor(machine).start();
    const child = actor.getSnapshot().children['worker:0'] as AnyActor;
    expect(child.address).toBe('order/worker:0');
  });

  it('addresses are stable across restore while sessionIds are not', () => {
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

    const actor = createActor(machine).start();
    const child = actor.getSnapshot().children['worker:0'] as AnyActor;
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const restored = createActor(machine, { snapshot: persisted }).start();
    const restoredChild = restored.getSnapshot().children[
      'worker:0'
    ] as AnyActor;
    expect(restoredChild.address).toBe(child.address);
    expect(restoredChild.sessionId).not.toBe(child.sessionId);
  });
});

describe('effect descriptors', () => {
  it('spawn and sendTo effects serialize to addresses and src keys', () => {
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

    const [snapshot, initialEffects] = initialTransition(machine);
    const spawnDescriptor = initialEffects
      .map(getEffectDescriptor)
      .find((d) => d.type === '@xstate.spawn');
    expect(spawnDescriptor).toEqual({
      kind: 'builtin',
      type: '@xstate.spawn',
      source: 'order',
      actor: 'order/worker:0',
      id: 'worker:0',
      src: 'worker',
      input: undefined
    });

    const [, effects] = transition(machine, snapshot, { type: 'KICK' });
    const sendDescriptor = effects
      .map(getEffectDescriptor)
      .find((d) => d.type === '@xstate.sendTo');
    expect(sendDescriptor).toEqual({
      kind: 'builtin',
      type: '@xstate.sendTo',
      source: 'order',
      target: 'order/worker:0',
      event: { type: 'PING' },
      id: undefined,
      delay: undefined
    });

    // Descriptors are JSON-safe: no live refs, no functions.
    for (const effect of [...initialEffects, ...effects]) {
      const descriptor = getEffectDescriptor(effect);
      expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor);
    }
  });
});

describe('string-id sendTo', () => {
  it('resolves ids against existing children', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker, { id: 'w' });
      },
      states: {
        a: {
          on: {
            KICK: (_, enq) => {
              enq.sendTo('w', { type: 'PING' });
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'KICK' });
    const child = actor.getSnapshot().children.w as AnyActor;
    expect(child.getSnapshot().value).toBe('pinged');
  });

  it('resolves ids of children spawned in the same transition', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker, { id: 'w' });
        enq.sendTo('w', { type: 'PING' });
      },
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    const child = actor.getSnapshot().children.w as AnyActor;
    expect(child.getSnapshot().value).toBe('pinged');
  });
});

describe('sessionId as incarnation id', () => {
  const invokeMachine = setup({
    actors: { worker: workerMachine }
  }).createMachine({
    id: 'order',
    initial: 'working',
    states: {
      working: {
        invoke: {
          id: 'w',
          src: 'worker',
          onDone: { target: 'finished' }
        }
      },
      finished: { type: 'final' }
    }
  });

  it('drops completions from a previous incarnation after restore', () => {
    const actor = createActor(invokeMachine).start();
    const staleSessionId = (actor.getSnapshot().children.w as AnyActor)
      .sessionId;
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const restored = createActor(invokeMachine, { snapshot: persisted });
    restored.start();
    restored.send({
      type: 'xstate.done.actor',
      actorId: 'w',
      output: undefined,
      sessionId: staleSessionId
    } as never);
    expect(restored.getSnapshot().value).toBe('working');
  });

  it('accepts completions from the current incarnation', () => {
    const actor = createActor(invokeMachine).start();
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const restored = createActor(invokeMachine, { snapshot: persisted });
    restored.start();
    const currentSessionId = (restored.getSnapshot().children.w as AnyActor)
      .sessionId;
    restored.send({
      type: 'xstate.done.actor',
      actorId: 'w',
      output: undefined,
      sessionId: currentSessionId
    } as never);
    expect(restored.getSnapshot().value).toBe('finished');
    expect(restored.getSnapshot().status).toBe('done');
  });
});

describe('children-by-address persistence', () => {
  const coordinatorMachine = setup({
    actors: { worker: workerMachine }
  }).createMachine({
    id: 'coordinator',
    initial: 'a',
    entry: ({ actors }, enq) => {
      enq.spawn(actors.worker);
    },
    states: {
      a: {
        on: {
          MORE: ({ actors }, enq) => {
            enq.spawn(actors.worker);
          }
        }
      }
    }
  });

  it('persisted children carry their logical address', () => {
    const actor = createActor(coordinatorMachine).start();
    const persisted = actor.getPersistedSnapshot() as unknown as {
      children: Record<string, { address: string; src: string }>;
    };
    expect(persisted.children['worker:0']).toMatchObject({
      address: 'coordinator/worker:0',
      src: 'worker'
    });
  });

  it('an actor owns its id counters in its own persisted snapshot', () => {
    const orderMachine = setup({
      actors: { coordinator: coordinatorMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.coordinator);
      },
      states: { a: {} }
    });

    const root = createActor(orderMachine).start();
    const coordinator = root.getSnapshot().children[
      'coordinator:0'
    ] as AnyActor;
    coordinator.send({ type: 'MORE' });
    // Persist ONLY the subtree; its counters must travel with it.
    const persistedSubtree = coordinator.getPersistedSnapshot() as {
      _nextActorIds?: Record<string, number>;
    };
    expect(persistedSubtree._nextActorIds).toEqual({ worker: 2 });
    root.stop();

    // Restore the subtree standalone (a different placement) and keep
    // spawning: numbering continues with no shared system state.
    const restored = createActor(coordinatorMachine, {
      snapshot: persistedSubtree as never
    }).start();
    restored.send({ type: 'MORE' });
    expect(Object.keys(restored.getSnapshot().children).sort()).toEqual([
      'worker:0',
      'worker:1',
      'worker:2'
    ]);
  });
});
