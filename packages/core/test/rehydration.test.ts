import { BehaviorSubject } from 'rxjs';
import {
  createMachine,
  createActor,
  createAsyncLogic,
  createObservableLogic,
  createStepLogic,
  InvalidSnapshotError,
  type AnyActor,
  type AnyStateMachine,
  type RestorablePersistedSnapshotFor,
  type Snapshot
} from '../src/index.ts';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';

describe('rehydration', () => {
  describe('using persisted state', () => {
    it('should be able to use `hasTag` immediately', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            tags: ['foo']
          }
        }
      });

      const actorRef = createActor(machine).start();
      const persistedState = JSON.stringify(actorRef.getPersistedSnapshot());
      actorRef.stop();

      const service = createActor(machine, {
        snapshot: JSON.parse(persistedState)
      }).start();

      expect(service.getSnapshot().hasTag('foo')).toBe(true);
    });

    it('should not call exit actions when machine gets stopped immediately', () => {
      const actual: string[] = [];
      const machine = createMachine({
        // exit: () => actual.push('root'),
        exit: (_, enq) => enq(() => actual.push('root')),
        initial: 'a',
        states: {
          a: {
            // exit: () => actual.push('a')
            exit: (_, enq) => enq(() => actual.push('a'))
          }
        }
      });

      const actorRef = createActor(machine).start();
      const persistedState = JSON.stringify(actorRef.getPersistedSnapshot());
      actorRef.stop();

      createActor(machine, { snapshot: JSON.parse(persistedState) })
        .start()
        .stop();

      expect(actual).toEqual([]);
    });

    it('should get correct result back from `can` immediately', () => {
      const machine = createMachine({
        on: {
          // FOO: {
          //   actions: () => {}
          // }
          FOO: (_, enq) => enq(() => {})
        }
      });

      const persistedState = JSON.stringify(
        createActor(machine).start().getSnapshot()
      );
      const restoredState = JSON.parse(persistedState);
      const service = createActor(machine, {
        snapshot: restoredState
      }).start();

      expect(service.getSnapshot().can({ type: 'FOO' })).toBe(true);
    });
  });

  describe('using state value', () => {
    it('should be able to use `hasTag` immediately', () => {
      const machine = createMachine({
        initial: 'inactive',
        states: {
          inactive: {
            on: { NEXT: { target: 'active' } }
          },
          active: {
            tags: ['foo']
          }
        }
      });

      const activeState = machine.resolveState({ value: 'active' });
      const service = createActor(machine, {
        snapshot: activeState
      });

      service.start();

      expect(service.getSnapshot().hasTag('foo')).toBe(true);
    });

    it('should not call exit actions when machine gets stopped immediately', () => {
      const actual: string[] = [];
      const machine = createMachine({
        // exit: () => actual.push('root'),
        exit: (_, enq) => enq(() => actual.push('root')),
        initial: 'inactive',
        states: {
          inactive: {
            on: { NEXT: { target: 'active' } }
          },
          active: {
            // exit: () => actual.push('active')
            exit: (_, enq) => enq(() => actual.push('active'))
          }
        }
      });

      createActor(machine, {
        snapshot: machine.resolveState({ value: 'active' })
      })
        .start()
        .stop();

      expect(actual).toEqual([]);
    });

    it('should error on incompatible state value (shallow)', () => {
      const machine = createMachine({
        initial: 'valid',
        states: {
          valid: {}
        }
      });

      expect(() => {
        machine.resolveState({ value: 'invalid' });
      }).toThrowError(/invalid/);
    });

    it('should error on incompatible state value (deep)', () => {
      const machine = createMachine({
        initial: 'parent',
        states: {
          parent: {
            initial: 'valid',
            states: {
              valid: {}
            }
          }
        }
      });

      expect(() => {
        machine.resolveState({ value: { parent: 'invalid' } });
      }).toThrowError(/invalid/);
    });
  });

  it('should not replay actions when starting from a persisted state', () => {
    const entrySpy = vi.fn();
    const machine = createMachine({
      entry: () => entrySpy()
    });

    const actor = createActor(machine).start();

    expect(entrySpy).toHaveBeenCalledTimes(1);

    const persistedState = actor.getPersistedSnapshot();

    actor.stop();

    createActor(machine, { snapshot: persistedState }).start();

    expect(entrySpy).toHaveBeenCalledTimes(1);
  });

  it('should be able to stop a rehydrated child', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: createAsyncLogic({ run: () => Promise.resolve(11) }),
            onDone: { target: 'b' }
          },
          on: {
            NEXT: { target: 'c' }
          }
        },
        b: {},
        c: {}
      }
    });

    const actor = createActor(machine).start();
    const persistedState = actor.getPersistedSnapshot();
    actor.stop();

    const rehydratedActor = createActor(machine, {
      snapshot: persistedState
    }).start();

    expect(() =>
      rehydratedActor.send({
        type: 'NEXT'
      })
    ).not.toThrow();

    expect(rehydratedActor.getSnapshot().value).toBe('c');
  });

  it('a rehydrated active child should be registered in the system', () => {
    const machine = createMachine({
      actors: {
        foo: createMachine({})
      },
      context: ({ spawn, actors }) => {
        spawn(actors.foo, {
          registryKey: 'mySystemId'
        });
        return {};
      }
    });

    const actor = createActor(machine).start();
    const persistedState = actor.getPersistedSnapshot();
    actor.stop();

    const rehydratedActor = createActor(machine, {
      snapshot: persistedState
    }).start();

    expect(rehydratedActor.system.get('mySystemId')).toBeDefined();
  });

  it('a rehydrated done child should not be registered in the system', () => {
    const machine = createMachine({
      actors: {
        foo: createMachine({ type: 'final' })
      },
      context: ({ spawn, actors }) => {
        spawn(actors.foo, {
          registryKey: 'mySystemId'
        });
        return {};
      }
    });

    const actor = createActor(machine).start();
    const persistedState = actor.getPersistedSnapshot();
    actor.stop();

    const rehydratedActor = createActor(machine, {
      snapshot: persistedState
    }).start();

    expect(rehydratedActor.system.get('mySystemId')).toBeUndefined();
  });

  it('a rehydrated done child should not re-notify the parent about its completion', () => {
    const spy = vi.fn();

    const machine = createMachine({
      actors: {
        foo: createMachine({ type: 'final' })
      },
      context: ({ spawn, actors }) => {
        spawn(actors.foo, {
          registryKey: 'mySystemId'
        });
        return {};
      },
      on: {
        '*': (_, enq) => enq(spy)
      }
    });

    const actor = createActor(machine).start();
    const persistedState = actor.getPersistedSnapshot();
    actor.stop();

    spy.mockClear();

    createActor(machine, {
      snapshot: persistedState
    }).start();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should be possible to persist a rehydrated actor that got its children rehydrated', () => {
    const machine = createMachine({
      actors: {
        foo: createAsyncLogic({ run: () => Promise.resolve(42) })
      },
      invoke: {
        src: 'foo'
      }
    });

    const actor = createActor(machine).start();

    const rehydratedActor = createActor(machine, {
      snapshot: actor.getPersistedSnapshot()
    }).start();

    const persistedChildren = (rehydratedActor.getPersistedSnapshot() as any)
      .children;
    expect(Object.keys(persistedChildren).length).toBe(1);
    expect((Object.values(persistedChildren)[0] as any).src).toBe('foo');
  });

  it('should complete on a rehydrated final state', () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: { NEXT: { target: 'bar' } }
        },
        bar: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });
    const persistedState = actorRef.getPersistedSnapshot();

    const spy = vi.fn();
    const actorRef2 = createActor(machine, { snapshot: persistedState });
    actorRef2.subscribe({
      complete: spy
    });

    actorRef2.start();
    expect(spy).toHaveBeenCalled();
  });

  it('should error on a rehydrated error state', async () => {
    const failure = createAsyncLogic({
      run: () => Promise.reject(new Error('failure'))
    });
    const machine = createMachine({
      invoke: {
        src: failure
      }
    });

    const actorRef = createActor(machine);
    actorRef.subscribe({ error: function preventUnhandledErrorListener() {} });
    actorRef.start();

    // wait a macrotask for the microtask related to the promise to be processed
    await sleep(0);

    const persistedState = actorRef.getPersistedSnapshot();

    const spy = vi.fn();
    const actorRef2 = createActor(machine, { snapshot: persistedState });
    actorRef2.subscribe({
      error: spy
    });
    actorRef2.start();

    expect(spy).toHaveBeenCalled();
  });

  it(`shouldn't re-notify the parent about the error when rehydrating`, async () => {
    const spy = vi.fn();
    const failure = createAsyncLogic({
      run: () => Promise.reject(new Error('failure'))
    });
    const machine = createMachine({
      invoke: {
        src: failure,
        onError: (_, enq) => enq(spy)
      }
    });

    const actorRef = createActor(machine);
    actorRef.start();

    // wait a macrotask for the microtask related to the promise to be processed
    await sleep(0);

    const persistedState = actorRef.getPersistedSnapshot();
    spy.mockClear();

    const actorRef2 = createActor(machine, { snapshot: persistedState });
    actorRef2.start();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should continue syncing snapshots', () => {
    const subject = new BehaviorSubject(0);
    const subjectLogic = createObservableLogic(() => subject);

    const spy = vi.fn();

    const machine = createMachine({
      actors: {
        service: subjectLogic
      },
      invoke: [
        {
          src: 'service',
          onSnapshot: ({ event }, enq) => {
            enq(spy, event.snapshot.context);
          }
        }
      ]
    });

    createActor(machine, {
      snapshot: createActor(machine).getPersistedSnapshot()
    }).start();

    spy.mockClear();

    subject.next(42);
    subject.next(100);

    expect(spy.mock.calls).toEqual([[42], [100]]);
  });

  it('should be able to rehydrate an actor deep in the tree', () => {
    const grandchild = createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: {
        count: 0
      },
      on: {
        INC: ({ context }) => ({
          context: {
            count: context.count + 1
          }
        })
      }
    });
    const child = createMachine({
      invoke: {
        src: grandchild,
        id: 'grandchild'
      },
      on: {
        // INC: {
        //   actions: sendTo('grandchild', {
        //     type: 'INC'
        //   })
        // }
        INC: ({ children }, enq) => {
          enq.sendTo(children.grandchild, { type: 'INC' });
        }
      }
    });
    const machine = createMachine({
      invoke: {
        src: child,
        id: 'child'
      },
      on: {
        // INC: {
        //   actions: sendTo('child', {
        //     type: 'INC'
        //   })
        // }
        INC: ({ children }, enq) => {
          enq.sendTo(children.child, { type: 'INC' });
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'INC' });

    const persistedState = actorRef.getPersistedSnapshot();
    const actorRef2 = createActor(machine, { snapshot: persistedState });

    expect(
      actorRef2
        .getSnapshot()
        .children.child.getSnapshot()
        .children.grandchild.getSnapshot().context.count
    ).toBe(1);
  });

  describe('persisted state value validation', () => {
    function restoreOnto<TLogic extends AnyStateMachine>(
      machine: TLogic,
      snapshot: Snapshot<unknown> & RestorablePersistedSnapshotFor<TLogic>
    ) {
      const restored = createActor(machine, { snapshot, input: undefined });
      restored.subscribe({ error: () => {} });
      restored.start();
      return restored.getSnapshot();
    }

    it('should error with a descriptive message when the persisted state value references a top-level state that no longer exists', () => {
      const machine = createMachine({
        id: 'order-approval',
        initial: 'reviewing',
        states: { reviewing: {}, approved: {} }
      });
      const actorRef = createActor(machine).start();
      const snapshot = actorRef.getPersistedSnapshot();
      actorRef.stop();

      const renamedMachine = createMachine({
        id: 'order-approval',
        initial: 'awaitingApproval',
        states: { awaitingApproval: {}, approved: {} }
      });

      expect(restoreOnto(renamedMachine, snapshot)).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          message:
            "Persisted snapshot references state 'reviewing' which does not exist on machine 'order-approval'."
        })
      });
    });

    it('should error with the full state path when a nested state no longer exists', () => {
      const machine = createMachine({
        id: 'order-approval',
        initial: 'active',
        states: {
          active: {
            initial: 'reviewing',
            states: { reviewing: {}, done: {} }
          }
        }
      });
      const actorRef = createActor(machine).start();
      const snapshot = actorRef.getPersistedSnapshot();
      actorRef.stop();

      const renamedMachine = createMachine({
        id: 'order-approval',
        initial: 'active',
        states: {
          active: {
            initial: 'awaitingApproval',
            states: { awaitingApproval: {}, done: {} }
          }
        }
      });

      expect(restoreOnto(renamedMachine, snapshot)).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          message:
            "Persisted snapshot references state 'active.reviewing' which does not exist on machine 'order-approval'."
        })
      });
    });

    it('should error when a parent of a nested state value no longer exists', () => {
      const machine = createMachine({
        id: 'order-approval',
        initial: 'active',
        states: {
          active: {
            initial: 'reviewing',
            states: { reviewing: {} }
          }
        }
      });
      const actorRef = createActor(machine).start();
      const snapshot = actorRef.getPersistedSnapshot();
      actorRef.stop();

      const renamedMachine = createMachine({
        id: 'order-approval',
        initial: 'running',
        states: {
          running: {
            initial: 'reviewing',
            states: { reviewing: {} }
          }
        }
      });

      expect(restoreOnto(renamedMachine, snapshot)).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          message:
            "Persisted snapshot references state 'active' which does not exist on machine 'order-approval'."
        })
      });
    });

    it('should error when a region of a parallel state value no longer exists', () => {
      const machine = createMachine({
        id: 'order-approval',
        type: 'parallel',
        states: {
          review: { initial: 'reviewing', states: { reviewing: {} } },
          payment: { initial: 'pending', states: { pending: {} } }
        }
      });
      const actorRef = createActor(machine).start();
      const snapshot = actorRef.getPersistedSnapshot();
      actorRef.stop();

      const renamedMachine = createMachine({
        id: 'order-approval',
        type: 'parallel',
        states: {
          review: {
            initial: 'awaitingApproval',
            states: { awaitingApproval: {} }
          },
          payment: { initial: 'pending', states: { pending: {} } }
        }
      });

      expect(restoreOnto(renamedMachine, snapshot)).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          message:
            "Persisted snapshot references state 'review.reviewing' which does not exist on machine 'order-approval'."
        })
      });
    });

    describe('malformed snapshots', () => {
      const machine = createMachine({
        id: 'order-approval',
        initial: 'reviewing',
        states: {
          reviewing: { on: { APPROVE: { target: 'approved' } } },
          approved: {}
        }
      });
      const parallelMachine = createMachine({
        id: 'order-approval',
        initial: 'active',
        states: {
          active: {
            initial: 'reviewing',
            states: { reviewing: {}, approved: {} }
          }
        }
      });

      function restoreMalformed(logic: AnyStateMachine, snapshot: unknown) {
        const restored = createActor(logic, {
          snapshot: snapshot as any,
          input: undefined
        });
        restored.subscribe({ error: () => {} });
        restored.start();
        return restored;
      }

      function persisted(overrides: Record<string, unknown>) {
        const actorRef = createActor(machine).start();
        const snapshot = actorRef.getPersistedSnapshot();
        actorRef.stop();
        return { ...(snapshot as object), ...overrides };
      }

      it.each([
        ['null', null],
        ['a string', 'reviewing'],
        ['a number', 42],
        ['an array', [] as unknown[]]
      ])(
        'should error with InvalidSnapshotError when the snapshot is %s',
        (_, snapshot) => {
          const restored = restoreMalformed(machine, snapshot);
          const restoredSnapshot = restored.getSnapshot();

          expect(restoredSnapshot.status).toBe('error');
          expect(restoredSnapshot.error).toBeInstanceOf(InvalidSnapshotError);
          expect(restoredSnapshot.error).toMatchObject({
            name: 'InvalidSnapshotError',
            message:
              "Persisted snapshot for machine 'order-approval' must be an object."
          });
          // Machine-shaped error snapshot, like a missing-state restore.
          expect(restoredSnapshot.can({ type: 'APPROVE' })).toBe(false);
        }
      );

      it('should error with InvalidSnapshotError when the state value is missing', () => {
        const { value: _value, ...snapshot } = persisted({});

        expect(restoreMalformed(machine, snapshot).getSnapshot()).toMatchObject(
          {
            status: 'error',
            error: expect.objectContaining({
              name: 'InvalidSnapshotError',
              message:
                "Persisted snapshot for machine 'order-approval' has no state value."
            })
          }
        );
      });

      it.each([
        ['a number', 42],
        ['null', null],
        ['an array', ['reviewing']],
        ['a boolean', true]
      ])(
        'should error with InvalidSnapshotError when the state value is %s',
        (_, value) => {
          expect(
            restoreMalformed(machine, persisted({ value })).getSnapshot()
          ).toMatchObject({
            status: 'error',
            error: expect.objectContaining({
              name: 'InvalidSnapshotError',
              message:
                "Persisted snapshot for machine 'order-approval' has an invalid state value: expected a state name or an object of state values."
            })
          });
        }
      );

      it('should error with InvalidSnapshotError when a nested state value is invalid', () => {
        expect(
          restoreMalformed(
            parallelMachine,
            persisted({ value: { active: 42 } })
          ).getSnapshot()
        ).toMatchObject({
          status: 'error',
          error: expect.objectContaining({
            name: 'InvalidSnapshotError',
            message:
              "Persisted snapshot for machine 'order-approval' has an invalid state value at 'active': expected a state name or an object of state values."
          })
        });
      });

      it('should error with InvalidSnapshotError when a non-parallel state has several active children', () => {
        expect(
          restoreMalformed(
            parallelMachine,
            persisted({ value: { active: { reviewing: {}, approved: {} } } })
          ).getSnapshot()
        ).toMatchObject({
          status: 'error',
          error: expect.objectContaining({
            name: 'InvalidSnapshotError',
            message:
              "Persisted snapshot for machine 'order-approval' has an invalid state value at 'active': state 'active' is not parallel, so only one child state can be active."
          })
        });
      });

      it('should report missing states as InvalidSnapshotError', () => {
        expect(
          restoreMalformed(
            machine,
            persisted({ value: 'archived' })
          ).getSnapshot()
        ).toMatchObject({
          status: 'error',
          error: expect.objectContaining({
            name: 'InvalidSnapshotError',
            message:
              "Persisted snapshot references state 'archived' which does not exist on machine 'order-approval'."
          })
        });
      });

      it('should complete a partial state value with initial states', () => {
        const restored = restoreMalformed(
          parallelMachine,
          persisted({ value: { active: {} } })
        );
        const snapshot = restored.getSnapshot();

        expect(snapshot.status).toBe('active');
        expect(snapshot.value).toEqual({ active: 'reviewing' });
        expect(snapshot.matches('active.reviewing' as never)).toBe(true);
        expect(restored.getPersistedSnapshot()).toMatchObject({
          value: { active: 'reviewing' }
        });
      });

      it('should still ignore unknown fields', () => {
        const restored = restoreMalformed(
          machine,
          persisted({ somethingElse: true })
        );

        expect(restored.getSnapshot().status).toBe('active');
        restored.send({ type: 'APPROVE' });
        expect(restored.getSnapshot().value).toBe('approved');
      });
    });

    it('should restore successfully when the persisted state value is valid', () => {
      const machine = createMachine({
        id: 'order-approval',
        type: 'parallel',
        states: {
          review: { initial: 'reviewing', states: { reviewing: {} } },
          payment: { initial: 'pending', states: { pending: {} } }
        }
      });
      const actorRef = createActor(machine).start();
      const snapshot = actorRef.getPersistedSnapshot();
      actorRef.stop();

      const restored = createActor(machine, { snapshot }).start();

      expect(restored.getSnapshot().status).toBe('active');
      expect(restored.getSnapshot().value).toEqual({
        review: 'reviewing',
        payment: 'pending'
      });
    });
  });
});

describe('inline invoke persistence', () => {
  const counter = createStepLogic({
    context: { count: 0 },
    run: ({ context, event }) => ({
      context: event.type === 'INC' ? { count: context.count + 1 } : context
    })
  });

  function persistAfterIncrement(
    machine: AnyStateMachine,
    childId: string,
    input?: unknown
  ) {
    const actor = createActor(machine, { input } as never).start();
    actor.getSnapshot().children[childId]!.send({ type: 'INC' });
    const persisted = actor.getPersistedSnapshot() as any;
    actor.stop();
    return persisted;
  }

  it('persists an inline invoke without `src` and restores it', () => {
    const machine = createMachine({
      id: 'parent',
      initial: 'active',
      states: {
        active: {
          initial: 'running',
          states: { running: { invoke: { id: 'counter', src: counter } } }
        }
      }
    });

    const persisted = persistAfterIncrement(machine, 'counter');

    expect(persisted.children.counter).not.toHaveProperty('src');

    const restored = createActor(machine, {
      snapshot: JSON.parse(JSON.stringify(persisted))
    }).start();
    const child = restored.getSnapshot().children.counter as AnyActor;
    expect(restored.getSnapshot().status).toBe('active');
    expect(child.getSnapshot().context).toEqual({ count: 1 });
    child.send({ type: 'INC' });
    expect(child.getSnapshot().context).toEqual({ count: 2 });
  });

  it('restores inline invokes in parallel regions', () => {
    const other = createStepLogic({
      context: { name: 'other' },
      run: ({ context }) => ({ context })
    });
    const machine = createMachine({
      id: 'parent',
      type: 'parallel',
      states: {
        a: { invoke: { id: 'counter', src: counter } },
        b: { invoke: { id: 'other', src: other } }
      }
    });

    const persisted = persistAfterIncrement(machine, 'counter');
    expect(persisted.children.counter).not.toHaveProperty('src');
    expect(persisted.children.other).not.toHaveProperty('src');

    const restored = createActor(machine, { snapshot: persisted }).start();
    const { children } = restored.getSnapshot();
    expect((children.counter as AnyActor).getSnapshot().context).toEqual({
      count: 1
    });
    expect((children.other as AnyActor).getSnapshot().context).toEqual({
      name: 'other'
    });
  });

  it('resolves a reused invoke id against the active state only', () => {
    const other = createStepLogic({
      context: { count: 100 },
      run: ({ context, event }) => ({
        context: event.type === 'INC' ? { count: context.count + 100 } : context
      })
    });
    const machine = createMachine({
      id: 'parent',
      initial: 'first',
      states: {
        first: {
          invoke: { id: 'worker', src: other },
          on: { NEXT: { target: 'second' } }
        },
        second: { invoke: { id: 'worker', src: counter } }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });
    actor.getSnapshot().children.worker!.send({ type: 'INC' });
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const restored = createActor(machine, { snapshot: persisted }).start();
    const child = restored.getSnapshot().children.worker as AnyActor;
    expect(child.getSnapshot().context).toEqual({ count: 1 });
    child.send({ type: 'INC' });
    expect(child.getSnapshot().context).toEqual({ count: 2 });
  });

  it('keeps the source key of a registered invoke', () => {
    const machine = createMachine({
      id: 'parent',
      actors: { counter },
      invoke: { id: 'counter', src: 'counter' }
    });

    const persisted = persistAfterIncrement(machine, 'counter');
    expect(persisted.children.counter.src).toBe('counter');

    const restored = createActor(machine, { snapshot: persisted }).start();
    expect(
      (restored.getSnapshot().children.counter as AnyActor).getSnapshot()
        .context
    ).toEqual({ count: 1 });
  });

  it('errors when no active state invokes a source-less child', () => {
    const machine = createMachine({
      id: 'parent',
      initial: 'idle',
      states: {
        idle: { on: { GO: { target: 'running' } } },
        running: { invoke: { id: 'counter', src: counter } }
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'GO' });
    const persisted = actor.getPersistedSnapshot() as any;
    actor.stop();

    const restored = createActor(machine, {
      snapshot: { ...persisted, value: 'idle' }
    });
    restored.subscribe({ error: () => {} });
    restored.start();

    expect(restored.getSnapshot()).toMatchObject({
      status: 'error',
      error: expect.objectContaining({
        message:
          "Unable to restore child actor 'counter': it has no source key, and no active state of machine 'parent' invokes it."
      })
    });
  });
});

describe('replaced inline invoke persistence', () => {
  it('does not persist a child that replaced an inline invoke as that invoke', () => {
    const original = createStepLogic({
      context: { kind: 'original' },
      run: ({ context }) => ({ context })
    });
    const replacement = createStepLogic({
      context: { kind: 'replacement' },
      run: ({ context }) => ({ context })
    });
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'worker', src: original },
          on: {
            REPLACE: ({ children }, enq) => {
              enq.stop(children.worker);
              enq.spawn(replacement, { id: 'worker' });
            }
          }
        }
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'REPLACE' });
    expect(
      (actor.getSnapshot().children.worker as AnyActor).getSnapshot().context
    ).toEqual({ kind: 'replacement' });

    expect(() => actor.getPersistedSnapshot()).toThrow(
      'An inline child actor cannot be persisted.'
    );
  });
});
