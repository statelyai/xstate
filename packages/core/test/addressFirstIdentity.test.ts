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
  type AnyActor,
  createAsyncLogic,
  waitFor,
  SimulatedClock
} from '../src';
import { createDurable } from '../src/durable/index.ts';

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

describe('review findings: eighth round', () => {
  it('address encoding stays injective for ids containing % and /', () => {
    const machine = createMachine({
      id: 'order',
      initial: 'a',
      entry: (_: any, enq: any) => {
        // Without escaping '%', these two ids would collide on the same
        // address 'order/a%2Fb'.
        enq.spawn(workerMachine, { id: 'a/b' });
        enq.spawn(workerMachine, { id: 'a%2Fb' });
      },
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    const children = actor.getSnapshot().children;
    expect(children['a/b']!.address).toBe('order/a%2Fb');
    expect(children['a%2Fb']!.address).toBe('order/a%252Fb');
  });

  it('persisting an inline child by address fails loudly', () => {
    const machine = createMachine({
      id: 'order',
      initial: 'a',
      entry: (_: any, enq: any) => {
        enq.spawn(workerMachine);
      },
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    // By-address persistence needs a registered source key to restore from;
    // an inline child has none, so persisting must fail, not restore.
    expect(() =>
      actor.getPersistedSnapshot({
        embedChildren: false,
        __unsafeAllowInlineActors: true
      } as never)
    ).toThrow(/requires a registered source key/);
  });

  it('drops the legacy _nextActorId field on restore', () => {
    const machine = setup({
      actors: { worker: workerMachine }
    }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }: any, enq: any) => {
        enq.spawn(actors.worker);
      },
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    const persisted = actor.getPersistedSnapshot() as any;
    actor.stop();
    // Simulate a snapshot persisted before per-snapshot counters existed.
    persisted._nextActorId = 42;

    const restored = createActor(machine, { snapshot: persisted }).start();
    const repersisted = restored.getPersistedSnapshot() as any;
    expect('_nextActorId' in repersisted).toBe(false);
    expect(repersisted._nextActorIds).toEqual({ worker: 1 });
  });
});

describe('reserved id namespace', () => {
  it('rejects user sources that would number in the internal helper namespace', () => {
    // Internal helpers (enq.listen/enq.subscribeTo) number from system-level
    // counters; snapshot-owned children from per-snapshot counters. The
    // spaces stay collision-free only because their prefixes are disjoint.
    const impostor = createMachine({
      id: 'xstate.listener',
      initial: 'a',
      states: { a: {} }
    });
    const machine = createMachine({
      id: 'order',
      initial: 'a',
      entry: (_: any, enq: any) => {
        enq.spawn(impostor);
      },
      states: { a: {} }
    });

    const actor = createActor(machine);
    actor.subscribe({ error: () => {} });
    actor.start();
    expect(actor.getSnapshot().status).toBe('error');
    expect(actor.getSnapshot().error).toMatchObject({
      message: expect.stringMatching(/reserved for internal actors/)
    });
  });

  it('rejects explicit generated-shaped ids in the reserved namespace', () => {
    const machine = createMachine({
      id: 'order',
      initial: 'a',
      entry: (_: any, enq: any) => {
        enq.spawn(workerMachine, { id: 'xstate.listener:0' });
      },
      states: { a: {} }
    });

    const actor = createActor(machine);
    actor.subscribe({ error: () => {} });
    actor.start();
    expect(actor.getSnapshot().status).toBe('error');
  });
});

describe('unique child ids per parent', () => {
  it('throws when an explicit spawn id is already claimed in the same transition', () => {
    const machine = createMachine({
      id: 'p',
      initial: 'a',
      entry: (_: any, enq: any) => {
        enq.spawn(workerMachine, { id: 'dup' });
        enq.spawn(workerMachine, { id: 'dup' });
      },
      states: { a: {} }
    });
    const actor = createActor(machine);
    actor.subscribe({ error: () => {} });
    actor.start();
    expect(actor.getSnapshot().status).toBe('error');
    expect(actor.getSnapshot().error).toMatchObject({
      message: expect.stringMatching(/already in use by another child of 'p'/)
    });
  });

  it('throws when an explicit spawn id collides with a live child', () => {
    const machine = createMachine({
      id: 'p',
      initial: 'a',
      entry: (_: any, enq: any) => {
        enq.spawn(workerMachine, { id: 'dup' });
      },
      states: {
        a: {
          on: {
            AGAIN: (_: any, enq: any) => {
              enq.spawn(workerMachine, { id: 'dup' });
            }
          }
        }
      }
    });
    const actor = createActor(machine);
    actor.subscribe({ error: () => {} });
    actor.start();
    actor.send({ type: 'AGAIN' });
    expect(actor.getSnapshot().status).toBe('error');
  });

  it('throws for duplicate invoke ids across parallel regions', () => {
    const machine = setup({ actors: { worker: workerMachine } }).createMachine({
      id: 'p',
      type: 'parallel',
      states: {
        one: { invoke: { id: 'same', src: 'worker' } },
        two: { invoke: { id: 'same', src: 'worker' } }
      }
    });
    const actor = createActor(machine);
    actor.subscribe({ error: () => {} });
    actor.start();
    expect(actor.getSnapshot().status).toBe('error');
  });

  it('allows stop-then-spawn of the same id in one transition', () => {
    const machine = createMachine({
      id: 'p',
      initial: 'a',
      entry: (_: any, enq: any) => {
        enq.spawn(workerMachine, { id: 'w' });
      },
      states: {
        a: {
          on: {
            RESTART: ({ children }: any, enq: any) => {
              enq.stop(children.w);
              enq.spawn(workerMachine, { id: 'w' });
            }
          }
        }
      }
    });
    const actor = createActor(machine).start();
    const first = actor.getSnapshot().children.w;
    actor.send({ type: 'RESTART' });
    const second = actor.getSnapshot().children.w;
    expect(actor.getSnapshot().status).toBe('active');
    expect(second).not.toBe(first);
    expect(second!.address).toBe('p/w');
  });

  it('allows an invoke to restart with its id on reentry', () => {
    const machine = setup({ actors: { worker: workerMachine } }).createMachine({
      id: 'p',
      initial: 'a',
      states: {
        a: {
          invoke: { id: 'inv', src: 'worker' },
          on: { REENTER: { target: 'a', reenter: true } }
        }
      }
    });
    const actor = createActor(machine).start();
    const first = actor.getSnapshot().children.inv;
    actor.send({ type: 'REENTER' });
    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().children.inv).not.toBe(first);
  });
});

describe('history reentry stops the previous invoke', () => {
  it('restoring the source through a history state exits it first', () => {
    const machine = setup({ actors: { worker: workerMachine } }).createMachine({
      id: 'p',
      initial: 'running',
      states: {
        running: {
          on: { PING: { target: 'refresh' } },
          invoke: { id: 'inv', src: 'worker' }
        },
        refresh: { type: 'history', target: 'running' }
      }
    });
    const actor = createActor(machine).start();
    const first = actor.getSnapshot().children.inv as AnyActor;
    actor.send({ type: 'PING' });
    const second = actor.getSnapshot().children.inv as AnyActor;
    expect(second).not.toBe(first);
    // The previous incarnation must be stopped, not leaked at the same
    // address as the new one.
    expect(first.getSnapshot().status).toBe('stopped');
    expect(second.getSnapshot().status).toBe('active');
  });
});

describe('incarnation tokens on remote handles', () => {
  const invokeMachine = setup({
    actors: { worker: workerMachine }
  }).createMachine({
    id: 'order',
    initial: 'a',
    states: {
      a: {
        invoke: { id: 'w', src: 'worker', onDone: { target: 'finished' } }
      },
      finished: {}
    }
  });

  function persistedWithIncarnation(incarnation: string) {
    const actor = createActor(invokeMachine).start();
    const persisted = actor.getPersistedSnapshot({
      embedChildren: false
    }) as any;
    actor.stop();
    persisted.children.w.incarnation = incarnation;
    return persisted;
  }

  it('round-trips a host-supplied incarnation verbatim', () => {
    const restored = createActor(invokeMachine, {
      snapshot: persistedWithIncarnation('runtime-b:7')
    }).start();
    const handle = restored.getSnapshot().children.w as any;
    // The token IS the handle's sessionId: one incarnation identity, one field.
    expect(handle.sessionId).toBe('runtime-b:7');
    const repersisted = restored.getPersistedSnapshot({
      embedChildren: false
    }) as any;
    expect(repersisted.children.w.incarnation).toBe('runtime-b:7');
    restored.stop();
  });

  it('never stamps a token itself', () => {
    const actor = createActor(invokeMachine).start();
    const persisted = actor.getPersistedSnapshot({
      embedChildren: false
    }) as any;
    actor.stop();
    // A local sessionId in the snapshot would break replay determinism.
    expect(persisted.children.w.incarnation).toBeUndefined();
  });

  it('drops completions from a different incarnation when a token is present', () => {
    const restored = createActor(invokeMachine, {
      snapshot: persistedWithIncarnation('runtime-b:7')
    }).start();
    restored.send({
      type: 'xstate.done.actor',
      actorId: 'w',
      output: undefined,
      sessionId: 'runtime-b:3'
    } as never);
    expect(restored.getSnapshot().value).toBe('a');
    // The stale completion must not remove the still-running child either:
    // the parent keeps its handle until the real completion arrives.
    expect(restored.getSnapshot().children.w).toBeDefined();
    restored.send({
      type: 'xstate.done.actor',
      actorId: 'w',
      output: undefined,
      sessionId: 'runtime-b:7'
    } as never);
    expect(restored.getSnapshot().value).toBe('finished');
    restored.stop();
  });

  it('journals the target incarnation on sendTo descriptors', () => {
    const machine = setup({ actors: { worker: workerMachine } }).createMachine({
      id: 'order',
      initial: 'a',
      states: {
        a: {
          invoke: { id: 'w', src: 'worker' },
          on: {
            KICK: ({ children }, enq) => {
              enq.sendTo(children.w!, { type: 'PING' });
            }
          }
        }
      }
    });
    const actor = createActor(machine).start();
    const persisted = actor.getPersistedSnapshot({
      embedChildren: false
    }) as any;
    actor.stop();
    persisted.children.w.incarnation = 'runtime-b:7';

    const restored = machine.restoreSnapshot(persisted as never);
    const [, effects] = transition(machine, restored as never, {
      type: 'KICK'
    });
    const descriptor = getEffectDescriptor(effects[0]!) as any;
    expect(descriptor.type).toBe('@xstate.sendTo');
    expect(descriptor.incarnation).toBe('runtime-b:7');
  });
});

describe('dead letters', () => {
  it('routes undeliverable events to the runtime deadLetter operation', () => {
    const deadLetters: Array<{ target: string; type: string; reason: string }> =
      [];
    const machine = createMachine({ id: 'p', initial: 'a', states: { a: {} } });
    const actor = createActor(machine);
    actor.system.runtime = {
      deadLetter: (_source: any, target: any, event: any, reason: string) => {
        deadLetters.push({ target: target.address, type: event.type, reason });
      }
    };
    actor.start();
    actor.stop();
    actor.send({ type: 'LATE' });
    expect(deadLetters).toEqual([
      { target: 'p', type: 'LATE', reason: 'stopped' }
    ]);
  });

  it('emits a @xstate.deadletter inspection event', () => {
    const seen: string[] = [];
    const machine = createMachine({ id: 'p', initial: 'a', states: { a: {} } });
    const actor = createActor(machine, {
      inspect: (ev) => {
        if (ev.type === '@xstate.deadletter') {
          seen.push(`${ev.event.type}:${ev.reason}`);
        }
      }
    });
    actor.start();
    actor.stop();
    actor.send({ type: 'LATE' });
    expect(seen).toEqual(['LATE:stopped']);
  });
});

describe('timer restore honors wall-clock deadlines', () => {
  const timerMachine = createMachine({
    id: 'p',
    initial: 'waiting',
    states: {
      waiting: { after: { 1000: { target: 'fired' } } },
      fired: {}
    }
  });

  it('persists startedAt from a live runtime and resumes the remaining delay', () => {
    vi.useFakeTimers();
    try {
      const actor = createActor(timerMachine).start();
      vi.advanceTimersByTime(600);
      const persisted = actor.getPersistedSnapshot() as any;
      actor.stop();
      const [timer] = Object.values(persisted.timers) as any[];
      expect(timer.startedAt).toBe(Date.now() - 600);

      const restored = createActor(timerMachine, {
        snapshot: persisted
      }).start();
      vi.advanceTimersByTime(399);
      expect(restored.getSnapshot().value).toBe('waiting');
      vi.advanceTimersByTime(1);
      expect(restored.getSnapshot().value).toBe('fired');
      restored.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the same deadline across repeated persist/restore cycles', () => {
    vi.useFakeTimers();
    try {
      const actor = createActor(timerMachine).start();
      vi.advanceTimersByTime(300);
      const first = actor.getPersistedSnapshot() as any;
      actor.stop();

      const second = createActor(timerMachine, { snapshot: first }).start();
      vi.advanceTimersByTime(300);
      const repersisted = second.getPersistedSnapshot() as any;
      second.stop();
      // startedAt stays anchored to the original deadline, not re-derived
      // from the latest scheduling moment with the full declared delay.
      const [timer] = Object.values(repersisted.timers) as any[];
      expect(timer.startedAt + timer.delay).toBe(Date.now() + 400);

      const third = createActor(timerMachine, {
        snapshot: repersisted
      }).start();
      vi.advanceTimersByTime(400);
      expect(third.getSnapshot().value).toBe('fired');
      third.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a timer already past due fires immediately on restore', () => {
    vi.useFakeTimers();
    try {
      const actor = createActor(timerMachine).start();
      const persisted = actor.getPersistedSnapshot() as any;
      actor.stop();
      // Simulate a long gap while no process was running.
      vi.advanceTimersByTime(5000);

      const restored = createActor(timerMachine, {
        snapshot: persisted
      }).start();
      vi.advanceTimersByTime(0);
      expect(restored.getSnapshot().value).toBe('fired');
      restored.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('pure-transition snapshots persist no timestamp', () => {
    const [snapshot] = initialTransition(timerMachine);
    const persisted = timerMachine.getPersistedSnapshot(snapshot) as any;
    const [timer] = Object.values(persisted.timers) as any[];
    // No local schedule ran, so replayed persists stay byte-deterministic;
    // restoring falls back to the declared delay.
    expect(timer.startedAt).toBeUndefined();
  });
});

describe('runStep runtime operation', () => {
  it('a host runStep owns the step journal instead of the snapshot', async () => {
    const journal = new Map<string, unknown>();
    const calls: string[] = [];
    const logic = createAsyncLogic({
      run: async (_: any, enq: any) => {
        const a = await enq.step('a', async () => 1);
        const b = await enq.step('b', async () => a + 1);
        return b;
      }
    });
    const actor = createActor(logic);
    actor.system.runtime = {
      runStep: async (_target: any, key: string, exec: () => any) => {
        calls.push(key);
        if (journal.has(key)) {
          return journal.get(key);
        }
        const output = await exec();
        journal.set(key, output);
        return output;
      }
    };
    actor.start();
    const snapshot = await waitFor(actor, (s: any) => s.status === 'done');

    expect(snapshot.output).toBe(2);
    expect(calls).toEqual(['a', 'b']);
    expect(journal.get('a')).toBe(1);
    // The host replaced the built-in journal: nothing memoized locally.
    expect((snapshot as any).effects?.a).toBeUndefined();
    expect((snapshot as any).effects?.b).toBeUndefined();
  });

  it('a host runStep replays memoized results without re-running exec', async () => {
    const journal = new Map<string, unknown>([['a', 41]]);
    let executions = 0;
    const logic = createAsyncLogic({
      run: async (_: any, enq: any) => {
        const a = await enq.step('a', async () => {
          executions++;
          return 1;
        });
        return a + 1;
      }
    });
    const actor = createActor(logic);
    actor.system.runtime = {
      runStep: async (_target: any, key: string, exec: () => any) => {
        if (journal.has(key)) {
          return journal.get(key);
        }
        const output = await exec();
        journal.set(key, output);
        return output;
      }
    };
    actor.start();
    const snapshot = await waitFor(actor, (s: any) => s.status === 'done');
    expect(snapshot.output).toBe(42);
    expect(executions).toBe(0);
  });

  it('a durable adapter runStep receives the async child steps', async () => {
    const stepped: string[] = [];
    const asyncWorker = createAsyncLogic({
      id: 'asyncWorker',
      run: async (_: any, enq: any) => {
        await enq.step('warmup', async () => 'ok');
        return 'done';
      }
    });
    const machine = setup({ actors: { asyncWorker } }).createMachine({
      id: 'order',
      initial: 'a',
      entry: ({ actors }: any, enq: any) => {
        enq.spawn(actors.asyncWorker);
      },
      states: { a: {} }
    });

    const durable = createDurable(machine, {
      executeAction: (action: any, _meta: any, runtime: any) =>
        action.exec(runtime),
      startActor: (actor: any) => {
        actor.start();
      },
      runStep: async (actor: any, key: string, exec: () => any) => {
        stepped.push(`${actor.address}:${key}`);
        return exec();
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    await Promise.resolve();
    expect(stepped).toEqual(['order/asyncWorker:0:warmup']);
  });
});

describe('tenth round: review findings', () => {
  it('a completed child frees its id for the transition handling its completion', () => {
    const job = createMachine({
      initial: 'working',
      states: {
        working: { on: { FINISH: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const machine = createMachine({
      id: 'sup',
      initial: 'a',
      entry: (_: any, enq: any) => {
        enq.spawn(job, { id: 'job' });
      },
      states: {
        a: {
          on: {
            KICK: ({ children }: any, enq: any) => {
              enq.sendTo(children.job, { type: 'FINISH' });
            },
            // The supervisor pattern: respawn under the same name while
            // handling the outgoing child's completion.
            'xstate.done.actor': (_: any, enq: any) => {
              enq.spawn(job, { id: 'job' });
            }
          }
        }
      }
    });
    const actor = createActor(machine).start();
    const first = actor.getSnapshot().children.job;
    actor.send({ type: 'KICK' });
    expect(actor.getSnapshot().status).toBe('active');
    const replacement = actor.getSnapshot().children.job as AnyActor;
    expect(replacement).toBeDefined();
    expect(replacement).not.toBe(first);
    expect(replacement.getSnapshot().status).toBe('active');
  });

  it('restores under a custom clock with the declared delay', () => {
    const machine = createMachine({
      id: 'p',
      initial: 'waiting',
      states: {
        waiting: { after: { 1000: { target: 'fired' } } },
        fired: {}
      }
    });
    vi.useFakeTimers();
    let persisted: any;
    try {
      const actor = createActor(machine).start();
      vi.advanceTimersByTime(600);
      persisted = actor.getPersistedSnapshot();
      actor.stop();
    } finally {
      vi.useRealTimers();
    }
    const [timer] = Object.values(persisted.timers) as any[];
    expect(typeof timer.startedAt).toBe('number');

    // A wall-clock startedAt is meaningless under a simulated clock; the
    // declared delay applies instead of firing instantly (or never).
    const clock = new SimulatedClock();
    const restored = createActor(machine, {
      clock,
      snapshot: persisted
    }).start();
    clock.increment(999);
    expect(restored.getSnapshot().value).toBe('waiting');
    clock.increment(1);
    expect(restored.getSnapshot().value).toBe('fired');
    restored.stop();
  });

  it('captures root events for machine ids containing address separators', async () => {
    const worker = setup({}).createMachine({
      id: 'worker',
      initial: 'idle',
      entry: ({ parent }: any, enq: any) => {
        enq.sendTo(parent, { type: 'HELLO' });
      },
      states: { idle: {} }
    });
    const machine = setup({ actors: { worker } }).createMachine({
      id: 'a/b',
      initial: 'a',
      entry: ({ actors }: any, enq: any) => {
        enq.spawn(actors.worker);
      },
      states: { a: {} }
    });
    const durable = createDurable(machine, {
      executeAction: () => {},
      startActor: (actor: any) => {
        actor.start();
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });
    expect(durable.rootAddress).toBe('a%2Fb');
    const [, effects] = durable.initialTransition();
    const rootEvents = await durable.executeEffects(effects);
    expect(rootEvents.map((r: any) => r.event.type)).toEqual(['HELLO']);
  });
});

describe('remote handle serialization', () => {
  it('serializes with the same actor-reference marker as a co-located actor', () => {
    const machine = setup({ actors: { worker: workerMachine } }).createMachine({
      id: 'order',
      initial: 'a',
      states: {
        a: { invoke: { id: 'w', src: 'worker' } }
      }
    });
    const actor = createActor(machine).start();
    const persisted = actor.getPersistedSnapshot({ embedChildren: false });
    actor.stop();

    const restored = createActor(machine, { snapshot: persisted }).start();
    const handle = restored.getSnapshot().children.w as AnyActor;
    expect(handle.toJSON!()).toEqual({
      xstate$type: 'actorRef',
      id: 'w',
      address: 'order/w',
      src: 'worker'
    });
    // JSON round-trip of the whole snapshot keeps the discriminant, so
    // tooling that detects actor references sees remote children too.
    const json = JSON.parse(JSON.stringify(restored.getSnapshot())) as any;
    expect(json.children.w.xstate$type).toBe('actorRef');
    restored.stop();
  });
});

describe('timer startedAt survives a restore that never starts', () => {
  const timerMachine2 = createMachine({
    id: 'p2',
    initial: 'waiting',
    states: {
      waiting: { after: { 1000: { target: 'fired' } } },
      fired: {}
    }
  });

  it('re-persisting without a live schedule keeps the original deadline', () => {
    vi.useFakeTimers();
    try {
      const actor = createActor(timerMachine2).start();
      vi.advanceTimersByTime(600);
      const persisted = actor.getPersistedSnapshot() as any;
      actor.stop();
      const originalStart = Object.values(persisted.timers as any)[0] as any;

      // A restore → persist cycle with no local schedule (the durable-host
      // shape: pure restore, re-persist) must not push the deadline back.
      const restored = timerMachine2.restoreSnapshot(persisted as never);
      const repersisted = timerMachine2.getPersistedSnapshot(restored) as any;
      const carried = Object.values(repersisted.timers as any)[0] as any;
      expect(carried.startedAt).toBe(originalStart.startedAt);

      const resumed = createActor(timerMachine2, {
        snapshot: repersisted
      }).start();
      vi.advanceTimersByTime(399);
      expect(resumed.getSnapshot().value).toBe('waiting');
      vi.advanceTimersByTime(1);
      expect(resumed.getSnapshot().value).toBe('fired');
      resumed.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
