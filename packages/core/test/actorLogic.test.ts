import { EMPTY, interval, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  AnyActorRef,
  createMachine,
  createActor,
  AnyActorLogic,
  Snapshot
} from '../src/index.ts';
import {
  fromCallback,
  fromEventObservable,
  fromObservable,
  fromPromise,
  fromTransition
} from '../src/actors/index.ts';
import { waitFor } from '../src/waitFor.ts';
import { raise, sendTo } from '../src/actions.ts';

describe('promise logic (fromPromise)', () => {
  it('should interpret a promise', async () => {
    const promiseLogic = fromPromise(
      () =>
        new Promise<string>((res) => {
          setTimeout(() => res('hello'), 10);
        })
    );

    const actor = createActor(promiseLogic).start();

    const snapshot = await waitFor(actor, (s) => s.output === 'hello');

    expect(snapshot.output).toBe('hello');
  });
  it('should resolve', (done) => {
    const actor = createActor(fromPromise(() => Promise.resolve(42)));

    actor.subscribe((state) => {
      if (state.output === 42) {
        done();
      }
    });

    actor.start();
  });

  it('should resolve (observer .next)', (done) => {
    const actor = createActor(fromPromise(() => Promise.resolve(42)));

    actor.subscribe({
      next: (state) => {
        if (state.output === 42) {
          done();
        }
      }
    });

    actor.start();
  });

  it('should reject (observer .error)', (done) => {
    const actor = createActor(fromPromise(() => Promise.reject('Error')));

    actor.subscribe({
      error: (data) => {
        expect(data).toBe('Error');
        done();
      }
    });

    actor.start();
  });

  it('should complete (observer .complete)', async () => {
    const actor = createActor(fromPromise(() => Promise.resolve(42)));
    actor.start();

    const snapshot = await waitFor(actor, (s) => s.output === 42);

    expect(snapshot.output).toBe(42);
  });

  it('should not execute when reading initial state', async () => {
    let called = false;
    const logic = fromPromise(() => {
      called = true;
      return Promise.resolve(42);
    });

    const actor = createActor(logic);

    actor.getSnapshot();

    expect(called).toBe(false);
  });

  it('should persist an unresolved promise', (done) => {
    const promiseLogic = fromPromise(
      () =>
        new Promise<number>((res) => {
          setTimeout(() => res(42), 10);
        })
    );

    const actor = createActor(promiseLogic);
    actor.start();

    const resolvedPersistedState = actor.getPersistedSnapshot();
    actor.stop();

    const restoredActor = createActor(promiseLogic, {
      snapshot: resolvedPersistedState
    }).start();

    setTimeout(() => {
      expect(restoredActor.getSnapshot().output).toBe(42);
      done();
    }, 20);
  });

  it('should persist a resolved promise', (done) => {
    const promiseLogic = fromPromise(
      () =>
        new Promise<number>((res) => {
          res(42);
        })
    );

    const actor = createActor(promiseLogic);
    actor.start();

    setTimeout(() => {
      const resolvedPersistedState = actor.getPersistedSnapshot();

      expect(resolvedPersistedState).toMatchInlineSnapshot(`
        {
          "error": undefined,
          "input": undefined,
          "output": 42,
          "status": "done",
        }
      `);

      const restoredActor = createActor(promiseLogic, {
        snapshot: resolvedPersistedState
      }).start();
      expect(restoredActor.getSnapshot().output).toBe(42);
      done();
    }, 5);
  });

  it('should not invoke a resolved promise again', async () => {
    let createdPromises = 0;
    const promiseLogic = fromPromise(() => {
      createdPromises++;
      return Promise.resolve(createdPromises);
    });
    const actor = createActor(promiseLogic);
    actor.start();

    await new Promise((res) => setTimeout(res, 5));

    const resolvedPersistedState = actor.getPersistedSnapshot();
    expect(resolvedPersistedState).toMatchInlineSnapshot(`
      {
        "error": undefined,
        "input": undefined,
        "output": 1,
        "status": "done",
      }
    `);
    expect(createdPromises).toBe(1);

    const restoredActor = createActor(promiseLogic, {
      snapshot: resolvedPersistedState
    }).start();

    expect(restoredActor.getSnapshot().output).toBe(1);
    expect(createdPromises).toBe(1);
  });

  it('should not invoke a rejected promise again', async () => {
    let createdPromises = 0;
    const promiseLogic = fromPromise(() => {
      createdPromises++;
      return Promise.reject(createdPromises);
    });
    const actorRef = createActor(promiseLogic);
    actorRef.subscribe({ error: function preventUnhandledErrorListener() {} });
    actorRef.start();

    await new Promise((res) => setTimeout(res, 5));

    const rejectedPersistedState = actorRef.getPersistedSnapshot();
    expect(rejectedPersistedState).toMatchInlineSnapshot(`
      {
        "error": 1,
        "input": undefined,
        "output": undefined,
        "status": "error",
      }
    `);
    expect(createdPromises).toBe(1);

    const actorRef2 = createActor(promiseLogic, {
      snapshot: rejectedPersistedState
    });
    actorRef2.subscribe({ error: function preventUnhandledErrorListener() {} });
    actorRef2.start();

    expect(createdPromises).toBe(1);
  });

  it('should have access to the system', () => {
    expect.assertions(1);
    const promiseLogic = fromPromise(({ system }) => {
      expect(system).toBeDefined();
      return Promise.resolve(42);
    });

    createActor(promiseLogic).start();
  });

  it('should have reference to self', () => {
    expect.assertions(1);

    const promiseLogic = fromPromise(({ self }) => {
      expect(self.send).toBeDefined();
      return Promise.resolve(42);
    });

    createActor(promiseLogic).start();
  });
});

describe('transition function logic (fromTransition)', () => {
  it('should interpret a transition function', () => {
    const transitionLogic = fromTransition(
      (state, event) => {
        if (event.type === 'toggle') {
          return {
            ...state,
            enabled: state.enabled === 'on' ? ('off' as const) : ('on' as const)
          };
        }

        return state;
      },
      { enabled: 'on' as 'off' | 'on' }
    );

    const actor = createActor(transitionLogic).start();

    expect(actor.getSnapshot().context.enabled).toBe('on');

    actor.send({ type: 'toggle' });

    expect(actor.getSnapshot().context.enabled).toBe('off');
  });

  it('should persist a transition function', () => {
    const logic = fromTransition(
      (state, event) => {
        if (event.type === 'activate') {
          return { enabled: 'on' as const };
        }
        return state;
      },
      {
        enabled: 'off' as 'off' | 'on'
      }
    );
    const actor = createActor(logic).start();
    actor.send({ type: 'activate' });
    const persistedSnapshot = actor.getPersistedSnapshot();

    expect(persistedSnapshot).toEqual({
      status: 'active',
      output: undefined,
      error: undefined,
      context: {
        enabled: 'on'
      }
    });

    const restoredActor = createActor(logic, { snapshot: persistedSnapshot });

    restoredActor.start();

    expect(restoredActor.getSnapshot().context.enabled).toBe('on');
  });

  it('should have access to the system', () => {
    expect.assertions(1);
    const transitionLogic = fromTransition((_state, _event, { system }) => {
      expect(system).toBeDefined();
      return 42;
    }, 0);

    const actor = createActor(transitionLogic).start();

    actor.send({ type: 'a' });
  });

  it('should have reference to self', () => {
    expect.assertions(1);
    const transitionLogic = fromTransition((_state, _event, { self }) => {
      expect(self.send).toBeDefined();
      return 42;
    }, 0);

    const actor = createActor(transitionLogic).start();

    actor.send({ type: 'a' });
  });
});

describe('observable logic (fromObservable)', () => {
  it('should interpret an observable', async () => {
    const observableLogic = fromObservable(() => interval(10).pipe(take(4)));

    const actor = createActor(observableLogic).start();

    const snapshot = await waitFor(actor, (s) => s.status === 'done');

    expect(snapshot.context).toEqual(3);
  });

  it('should resolve', () => {
    const actor = createActor(fromObservable(() => of(42)));
    const spy = jest.fn();

    actor.subscribe((snapshot) => spy(snapshot.context));

    actor.start();

    expect(spy).toHaveBeenCalledWith(42);
  });

  it('should resolve (observer .next)', () => {
    const actor = createActor(fromObservable(() => of(42)));
    const spy = jest.fn();

    actor.subscribe({
      next: (snapshot) => spy(snapshot.context)
    });

    actor.start();
    expect(spy).toHaveBeenCalledWith(42);
  });

  it('should reject (observer .error)', () => {
    const actor = createActor(
      fromObservable(() => throwError(() => 'Observable error.'))
    );
    const spy = jest.fn();

    actor.subscribe({
      error: spy
    });

    actor.start();
    expect(spy).toMatchMockCallsInlineSnapshot(`
      [
        [
          "Observable error.",
        ],
      ]
    `);
  });

  it('should complete (observer .complete)', () => {
    const actor = createActor(fromObservable(() => EMPTY));
    const spy = jest.fn();

    actor.subscribe({
      complete: spy
    });

    actor.start();

    expect(spy).toHaveBeenCalled();
  });

  it('should not execute when reading initial state', () => {
    let called = false;
    const logic = fromObservable(() => {
      called = true;
      return EMPTY;
    });

    const actor = createActor(logic);

    actor.getSnapshot();

    expect(called).toBe(false);
  });

  it('should have access to the system', () => {
    expect.assertions(1);
    const observableLogic = fromObservable(({ system }) => {
      expect(system).toBeDefined();
      return of(42);
    });

    createActor(observableLogic).start();
  });

  it('should have reference to self', () => {
    expect.assertions(1);
    const observableLogic = fromObservable(({ self }) => {
      expect(self.send).toBeDefined();
      return of(42);
    });

    createActor(observableLogic).start();
  });
});

describe('eventObservable logic (fromEventObservable)', () => {
  it('should have access to the system', () => {
    expect.assertions(1);
    const observableLogic = fromEventObservable(({ system }) => {
      expect(system).toBeDefined();
      return of({ type: 'a' });
    });

    createActor(observableLogic).start();
  });

  it('should have reference to self', () => {
    expect.assertions(1);
    const observableLogic = fromEventObservable(({ self }) => {
      expect(self.send).toBeDefined();
      return of({ type: 'a' });
    });

    createActor(observableLogic).start();
  });
});

describe('callback logic (fromCallback)', () => {
  it('should interpret a callback', () => {
    expect.assertions(1);

    const callbackLogic = fromCallback(({ receive }) => {
      receive((event) => {
        expect(event).toEqual({ type: 'a' });
      });
    });

    const actor = createActor(callbackLogic).start();

    actor.send({ type: 'a' });
  });

  it('should have access to the system', () => {
    expect.assertions(1);
    const callbackLogic = fromCallback(({ system }) => {
      expect(system).toBeDefined();
    });

    createActor(callbackLogic).start();
  });

  it('should have reference to self', () => {
    expect.assertions(1);
    const callbackLogic = fromCallback(({ self }) => {
      expect(self.send).toBeDefined();
    });

    createActor(callbackLogic).start();
  });

  it('can send self reference in an event to parent', (done) => {
    const machine = createMachine({
      types: {} as {
        events: { type: 'PING'; ref: AnyActorRef };
      },
      invoke: {
        src: fromCallback(({ self, sendBack, receive }) => {
          receive((event) => {
            switch (event.type) {
              case 'PONG': {
                done();
              }
            }
          });

          sendBack({
            type: 'PING',
            ref: self
          });
        })
      },
      on: {
        PING: {
          actions: sendTo(
            ({ event }) => event.ref,
            () => ({ type: 'PONG' })
          )
        }
      }
    });

    createActor(machine).start();
  });

  it('should persist the input of a callback', () => {
    const spy = jest.fn();
    const machine = createMachine(
      {
        types: {} as { events: { type: 'EV'; data: number } },
        initial: 'a',
        states: {
          a: {
            on: {
              EV: 'b'
            }
          },
          b: {
            invoke: {
              src: 'cb',
              input: ({ event }) => event.data
            }
          }
        }
      },
      {
        actors: {
          cb: fromCallback(({ input }) => {
            spy(input);
          })
        }
      }
    );

    const actor = createActor(machine);
    actor.start();
    actor.send({
      type: 'EV',
      data: 13
    });

    const snapshot = actor.getPersistedSnapshot();

    actor.stop();

    spy.mockClear();

    const restoredActor = createActor(machine, { snapshot });

    restoredActor.start();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(13);
  });
});

describe('machine logic', () => {
  it('should persist a machine', async () => {
    const childMachine = createMachine({
      context: {
        count: 55
      },
      initial: 'start',
      states: {
        start: {
          invoke: {
            id: 'reducer',
            src: fromTransition((s) => s, undefined)
          }
        }
      }
    });

    const machine = createMachine({
      initial: 'waiting',
      invoke: [
        {
          id: 'a',
          src: fromPromise(() => Promise.resolve(42)),
          onDone: {
            actions: raise({ type: 'done' })
          }
        },
        {
          id: 'b',
          src: childMachine
        }
      ],
      states: {
        waiting: {
          on: {
            done: 'success'
          }
        },
        success: {}
      }
    });

    const actor = createActor(machine).start();

    await waitFor(actor, (s) => s.matches('success'));

    const persistedState = actor.getPersistedSnapshot()!;

    expect((persistedState as any).children.a.snapshot).toMatchInlineSnapshot(`
      {
        "error": undefined,
        "input": undefined,
        "output": 42,
        "status": "done",
      }
    `);

    expect((persistedState as any).children.b.snapshot).toEqual(
      expect.objectContaining({
        context: {
          count: 55
        },
        value: 'start',
        children: {
          reducer: expect.objectContaining({
            snapshot: {
              status: 'active'
            }
          })
        }
      })
    );
  });

  it('should persist and restore a nested machine', () => {
    const childMachine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            LAST: 'c'
          }
        },
        c: {}
      }
    });

    const parentMachine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            START: 'invoked'
          }
        },
        invoked: {
          invoke: {
            id: 'child',
            src: childMachine
          },
          on: {
            NEXT: {
              actions: sendTo('child', { type: 'NEXT' })
            },
            LAST: {
              actions: sendTo('child', { type: 'LAST' })
            }
          }
        }
      }
    });

    const actor = createActor(parentMachine).start();

    // parent is at 'idle'
    // ...
    actor.send({ type: 'START' });
    // parent is at 'invoked'
    // child is at 'a'
    // ...
    actor.send({ type: 'NEXT' });
    // child is at 'b'

    const persistedSnapshot = actor.getPersistedSnapshot()!;
    const newActor = createActor(parentMachine, {
      snapshot: persistedSnapshot
    }).start();
    const newSnapshot = newActor.getSnapshot();

    expect(newSnapshot.children.child.getSnapshot().value).toBe('b');

    // Ensure that the child actor is started
    // LAST is sent to parent which sends LAST to child
    newActor.send({ type: 'LAST' });
    // child is at 'c'

    expect(newActor.getSnapshot().children.child.getSnapshot().value).toBe('c');
  });

  it('should return the initial persisted state of a non-started actor', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    const actor = createActor(machine);

    expect(actor.getPersistedSnapshot()).toEqual(
      expect.objectContaining({
        value: 'idle'
      })
    );
  });

  it('the initial state of a child is available before starting the parent', () => {
    const machine = createMachine({
      invoke: {
        id: 'child',
        src: createMachine({
          initial: 'inner',
          states: { inner: {} }
        })
      }
    });

    const actor = createActor(machine);

    expect(
      (actor.getPersistedSnapshot() as any).children['child'].snapshot
    ).toEqual(
      expect.objectContaining({
        value: 'inner'
      })
    );
  });

  it('should not invoke an actor if it is missing in persisted state', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          invoke: {
            id: 'child',
            src: createMachine({
              context: ({ input }) => ({
                // this is only meant to showcase why we can't invoke this actor when it's missing in the persisted state
                // because we don't have access to the right input as it depends on the event that was used to enter state `b`
                value: input.deep.prop
              })
            }),
            input: ({ event }) => event.data
          }
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({
      type: 'NEXT',
      data: {
        deep: {
          prop: 'value'
        }
      }
    });

    expect(actor.getSnapshot().children.child).not.toBe(undefined);
    expect(actor.getSnapshot().children.child.getSnapshot().context).toEqual({
      value: 'value'
    });

    const persisted: any = actor.getPersistedSnapshot();

    delete persisted.children['child'];

    const rehydratedActor = createActor(machine, {
      snapshot: persisted
    }).start();

    expect(rehydratedActor.getSnapshot().children.child).toBe(undefined);
  });

  it('should persist a spawned actor with referenced src', () => {
    const reducer = fromTransition((s) => s, { count: 42 });
    const machine = createMachine({
      types: {
        context: {} as {
          ref: AnyActorRef;
        },
        actors: {} as {
          src: 'reducer';
          logic: typeof reducer;
          ids: 'child';
        }
      },
      context: ({ spawn }) => ({
        ref: spawn('reducer', { id: 'child' })
      })
    }).provide({
      actors: {
        reducer
      }
    });

    const actor = createActor(machine).start();

    const persistedSnapshot = actor.getPersistedSnapshot()!;

    expect((persistedSnapshot as any).children.child.snapshot.context).toEqual({
      count: 42
    });

    const newActor = createActor(machine, {
      snapshot: persistedSnapshot
    }).start();

    const snapshot = newActor.getSnapshot();

    expect(snapshot.context.ref).toBe(snapshot.children.child);

    expect(snapshot.context.ref.getSnapshot().context.count).toBe(42);
  });

  it('should not persist a spawned actor with inline src', () => {
    const machine = createMachine({
      context: ({ spawn }) => {
        return {
          childRef: spawn(createMachine({}))
        };
      }
    });

    const actorRef = createActor(machine).start();

    expect(() =>
      actorRef.getPersistedSnapshot()
    ).toThrowErrorMatchingInlineSnapshot(
      `"An inline child actor cannot be persisted."`
    );
  });

  it('should have access to the system', () => {
    expect.assertions(1);
    const machine = createMachine({
      entry: ({ system }) => {
        expect(system).toBeDefined();
      }
    });

    createActor(machine).start();
  });
});

describe('composable actor logic', () => {
  it('should work with machines', () => {
    const logs: string[] = [];

    function withLogs<T extends AnyActorLogic>(actorLogic: T): T {
      return {
        ...actorLogic,
        transition: (state, event, actorScope) => {
          logs.push(event.type);

          return actorLogic.transition(state, event, actorScope);
        }
      };
    }

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { to_b: 'b' }
        },
        b: {
          on: { to_c: 'c' }
        },
        c: {
          on: { to_a: 'a' }
        }
      }
    });

    const actor = createActor(withLogs(machine)).start();

    actor.send({ type: 'to_b' });
    actor.send({ type: 'to_c' });
    actor.send({ type: 'to_a' });

    expect(logs).toEqual(['to_b', 'to_c', 'to_a']);
  });

  it('should work with promises', async () => {
    const logs: any[] = [];

    function withLogs<T extends AnyActorLogic>(actorLogic: T): T {
      return {
        ...actorLogic,
        transition: (state: Snapshot<unknown>, event, actorScope) => {
          const s = actorLogic.transition(state, event, actorScope);
          logs.push(s.output);

          return s;
        }
      };
    }

    const promiseLogic = fromPromise(() => Promise.resolve(42));

    const actor = createActor(withLogs(promiseLogic)).start();

    await waitFor(actor, (s) => s.status === 'done');

    expect(logs).toEqual([42]);
  });

  it('should work with functions', () => {
    const logs: any[] = [];

    function withLogs<T extends AnyActorLogic>(actorLogic: T): T {
      return {
        ...actorLogic,
        transition: (state: Snapshot<unknown>, event, actorScope) => {
          const s = actorLogic.transition(state, event, actorScope);
          logs.push(s.context);

          return s;
        }
      };
    }

    const transitionLogic = fromTransition(
      (_, ev: { type: string; value: number }) => ev.value,
      0
    );

    const actor = createActor(withLogs(transitionLogic)).start();

    actor.send({ type: 'a', value: 42 });

    expect(logs).toEqual([42]);
  });

  it('should work with observables', (done) => {
    const logs: any[] = [];

    function withLogs<T extends AnyActorLogic>(actorLogic: T): T {
      return {
        ...actorLogic,
        transition: (state: Snapshot<unknown>, event, actorScope) => {
          const s = actorLogic.transition(state, event, actorScope);

          if (s.status === 'active') {
            logs.push(s.context);
          }

          return s;
        }
      };
    }

    const observableLogic = fromObservable(() => interval(10).pipe(take(4)));

    const actor = createActor(withLogs(observableLogic)).start();

    actor.subscribe({
      complete: () => {
        expect(logs).toEqual([0, 1, 2, 3]);
        done();
      }
    });
  });
});
