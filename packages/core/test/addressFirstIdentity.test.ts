import {
  createActor,
  createCallbackLogic,
  createFSM,
  createMachine,
  deliverEvent,
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

describe('detached children (remote handles)', () => {
  const invokeMachine = setup({
    actors: { worker: workerMachine }
  }).createMachine({
    id: 'order',
    initial: 'working',
    states: {
      working: {
        invoke: { id: 'w', src: 'worker', onDone: { target: 'finished' } },
        on: {
          KICK: ({ children }, enq) => {
            enq.sendTo(children.w, { type: 'PING' });
          }
        }
      },
      finished: { type: 'final' }
    }
  });

  it('persists children by address only when not embedding', () => {
    const actor = createActor(invokeMachine).start();
    const persisted = actor.getPersistedSnapshot({
      embedChildren: false
    }) as unknown as { children: Record<string, unknown> };
    expect(persisted.children.w).toEqual({
      address: 'order/w',
      remote: true,
      src: 'worker',
      registryKey: undefined,
      syncSnapshot: false
    });
    actor.stop();
  });

  it('restores address-only children as location-transparent handles', () => {
    const actor = createActor(invokeMachine).start();
    const persisted = actor.getPersistedSnapshot({
      embedChildren: false
    });
    actor.stop();

    const restored = createActor(invokeMachine, {
      snapshot: persisted
    }).start();
    const handle = restored.getSnapshot().children.w as AnyActor;
    expect(handle.address).toBe('order/w');
    expect(handle.sessionId).toBeUndefined();
    expect(handle.getSnapshot().status).toBe('active');

    // Remote state round-trips by address, never re-embedding.
    const again = restored.getPersistedSnapshot() as unknown as {
      children: Record<string, { address: string; snapshot?: unknown }>;
    };
    expect(again.children.w.address).toBe('order/w');
    expect(again.children.w.snapshot).toBeUndefined();
  });

  it('co-located-only members throw a descriptive error on a remote handle', () => {
    const actor = createActor(invokeMachine).start();
    const persisted = actor.getPersistedSnapshot({ embedChildren: false });
    actor.stop();

    const restored = createActor(invokeMachine, {
      snapshot: persisted
    }).start();
    const handle = restored.getSnapshot().children.w as AnyActor;

    expect(() => handle.stop()).toThrow(/co-located/);
    expect(() => handle.select((s) => s)).toThrow(/remote actor/i);
    expect(() => handle.trigger).toThrow(/co-located/);
    restored.stop();
  });

  it('accepts completions for remote children from any incarnation', () => {
    const actor = createActor(invokeMachine).start();
    const persisted = actor.getPersistedSnapshot({
      embedChildren: false
    });
    actor.stop();

    const restored = createActor(invokeMachine, {
      snapshot: persisted
    }).start();
    restored.send({
      type: 'xstate.done.actor',
      actorId: 'w',
      output: undefined,
      sessionId: 'some-other-runtime:7'
    } as never);
    expect(restored.getSnapshot().value).toBe('finished');
  });
});

describe('review findings: allocation across a macrostep', () => {
  it('spawns of one source across microsteps get distinct ids', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker);
        enq.raise({ type: 'AGAIN' });
      },
      states: {
        a: {
          on: {
            AGAIN: ({ actors }, enq) => {
              enq.spawn(actors.worker);
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    expect(Object.keys(actor.getSnapshot().children).sort()).toEqual([
      'worker:0',
      'worker:1'
    ]);
  });

  it('context spawns and entry spawns of one source do not collide', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      context: ({ spawn }) => ({
        ref: spawn(workerMachine)
      }),
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker);
      },
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    const ids = Object.keys(actor.getSnapshot().children);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('review findings: identity edge cases', () => {
  it('parentless actors of one machine in a shared system get distinct addresses', async () => {
    const { createSystem } = await import('../src/index.ts');
    const system = createSystem();
    const machine = createMachine({
      id: 'order',
      initial: 'a',
      states: { a: {} }
    });
    const first = system.createActor(machine);
    const second = system.createActor(machine);
    expect(first.address).toBe('order');
    expect(second.address).not.toBe(first.address);
  });

  it('re-persisting a restored snapshot with a context-held remote child does not recurse', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      context: ({ spawn }) => ({
        ref: spawn(workerMachine, { src: 'worker' } as never)
      }),
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    const persisted = actor.getPersistedSnapshot({ embedChildren: false });
    actor.stop();

    const restored = createActor(machine, { snapshot: persisted }).start();
    const again = restored.getPersistedSnapshot() as unknown as {
      children: Record<string, { address: string; snapshot?: unknown }>;
    };
    expect(Object.values(again.children)[0]?.address).toMatch(/^order\//);
  });
});

describe('review findings: second round', () => {
  it('records sent[] inspection for sends delivered by a host runtime', () => {
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
            KICK: ({ children }, enq) => {
              enq.sendTo(children.w, { type: 'PING' });
            }
          }
        }
      }
    });

    const sent: string[] = [];
    const actor = createActor(machine, {
      inspect: (event) => {
        if (event.type === '@xstate.transition') {
          for (const record of event.sent) {
            sent.push(`${record.targetId}:${record.event.type}`);
          }
        }
      }
    });
    actor.system.runtime = {
      sendEvent: (source, target, event) => {
        deliverEvent(source, target, event);
      }
    };
    actor.start();
    actor.send({ type: 'KICK' });
    expect(sent).toContain('w:PING');
  });

  it('explicit generated-shaped ids reserve numbering for live runs and replays', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker, { id: 'worker:5' });
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

    // Live run.
    const live = createActor(machine).start();
    live.send({ type: 'MORE' });
    expect(Object.keys(live.getSnapshot().children).sort()).toEqual([
      'worker:5',
      'worker:6'
    ]);
    const persisted = live.getPersistedSnapshot();
    live.stop();

    // Pure replay from the checkpoint taken before MORE must allocate the
    // same id even in a fresh process (fresh system counters).
    const [initial] = initialTransition(machine);
    const [afterMore] = transition(machine, initial, { type: 'MORE' });
    expect(Object.keys(afterMore.children).sort()).toEqual([
      'worker:5',
      'worker:6'
    ]);
    void persisted;
  });

  it('address-only restore keeps registryKey lookups and syncSnapshot', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker, {
          id: 'w',
          registryKey: 'theWorker',
          syncSnapshot: true
        } as never);
      },
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    const persisted = actor.getPersistedSnapshot({ embedChildren: false });
    actor.stop();

    const restored = createActor(machine, { snapshot: persisted }).start();
    const handle = restored.system.get('theWorker' as never) as AnyActor;
    expect(handle).toBeDefined();
    expect(handle.address).toBe('order/w');

    const again = restored.getPersistedSnapshot({
      embedChildren: false
    }) as unknown as {
      children: Record<string, { syncSnapshot?: boolean }>;
    };
    expect(again.children.w.syncSnapshot).toBe(true);
  });
});

describe('review findings: third round', () => {
  it('context-spawn allocations persist so freed ids are not reused after restore', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      context: ({ spawn }) => ({
        ref: spawn(workerMachine, { src: 'worker' } as never)
      }),
      states: {
        a: {
          on: {
            STOP: ({ children }, enq) => {
              enq.stop(children['worker:0']);
            },
            MORE: ({ actors }, enq) => {
              enq.spawn(actors.worker);
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    expect(Object.keys(actor.getSnapshot().children)).toEqual(['worker:0']);
    actor.send({ type: 'STOP' });
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    // Fresh process: system counters are empty; the snapshot's own counters
    // must prevent the freed id from being handed out again.
    const restored = createActor(machine, { snapshot: persisted }).start();
    restored.send({ type: 'MORE' });
    expect(Object.keys(restored.getSnapshot().children)).toEqual(['worker:1']);
  });
});

describe('review findings: fourth round', () => {
  it('encodes the path delimiter in address segments', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a/b',
      states: { 'a/b': { invoke: { src: 'worker' } } }
    });

    // A slash in a state name reaches the generated invoke id; the machine
    // still starts, and the address stays an unambiguous path.
    const actor = createActor(machine).start();
    expect(actor.getSnapshot().status).toBe('active');
    const child = Object.values(actor.getSnapshot().children)[0] as AnyActor;
    expect(child.id).toContain('/');
    expect(child.address).toBe(`order/${child.id.replaceAll('/', '%2F')}`);
    expect(child.address.split('/')).toHaveLength(2);
  });

  it('restoring a remote child without a registered source key fails loudly', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker, { id: 'w' });
      },
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    const persisted = actor.getPersistedSnapshot({
      embedChildren: false
    }) as unknown as { children: Record<string, { src?: unknown }> };
    actor.stop();
    // Simulate a production-persisted inline child: non-string src.
    persisted.children.w.src = {};

    expect(() => machine.restoreSnapshot(persisted as never)).toThrow(
      /requires a registered source key/
    );
  });
});

describe('review findings: sixth round', () => {
  it('an explicit low id does not lower later generated allocations', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }, enq) => {
        enq.spawn(actors.worker);
        enq.spawn(actors.worker);
        enq.spawn(actors.worker);
      },
      states: {
        a: {
          on: {
            CLEAR: ({ children }, enq) => {
              enq.stop(children['worker:0']);
              enq.stop(children['worker:1']);
              enq.stop(children['worker:2']);
            },
            REUSE: ({ actors }, enq) => {
              // An explicit id the machine asks for by name, below the
              // parent's persisted counter...
              enq.spawn(actors.worker, { id: 'worker:0' });
              // ...must not drag generated numbering back onto freed ids.
              enq.spawn(actors.worker);
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'CLEAR' });
    actor.send({ type: 'REUSE' });
    expect(Object.keys(actor.getSnapshot().children).sort()).toEqual([
      'worker:0',
      'worker:3'
    ]);
  });
});

describe('review findings: seventh round', () => {
  it('keeps id counters across state-function state changes', () => {
    const fsm = createFSM({
      initial: 'a',
      states: {
        a: {
          entry: (_: any, enq: any) => {
            enq.spawn(workerMachine);
          },
          on: { GO: { target: 'b' } }
        },
        // A state change that spawns nothing must not drop the counters.
        b: { on: { GO2: { target: 'c' } } },
        c: {
          entry: (_: any, enq: any) => {
            enq.spawn(workerMachine);
          }
        }
      }
    });

    const actor = createActor(fsm).start();
    actor.send({ type: 'GO' });
    actor.send({ type: 'GO2' });
    expect(Object.keys(actor.getSnapshot().children).sort()).toEqual([
      'worker:0',
      'worker:1'
    ]);
  });

  it('gives internal helper actors their own id namespace', () => {
    const emitter = createCallbackLogic(() => {});
    const anonymous = createMachine({ initial: 'i', states: { i: {} } });
    let listener: AnyActor | undefined;
    const machine = createMachine({
      id: 'order',
      initial: 'a',
      entry: (_, enq) => {
        const child = enq.spawn(emitter);
        listener = enq.listen(child, 'E', () => ({ type: 'GOT' })) as AnyActor;
        enq.spawn(anonymous);
      },
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    const childAddresses = Object.values(actor.getSnapshot().children).map(
      (child) => (child as AnyActor).address
    );
    expect(childAddresses).not.toContain(listener!.address);
    expect(listener!.address).toBe('order/xstate.listener:0');
  });
});
