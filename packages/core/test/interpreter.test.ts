import { SimulatedClock } from '../src/SimulatedClock';
import {
  createActor,
  assign,
  sendParent,
  StateValue,
  createMachine,
  ActorRefFrom,
  ActorRef,
  cancel,
  raise,
  stop,
  log
} from '../src/index.ts';
import { isObservable } from '../src/utils';
import { interval, from } from 'rxjs';
import { fromObservable } from '../src/actors/observable';
import { PromiseActorLogic, fromPromise } from '../src/actors/promise';
import { fromCallback } from '../src/actors/callback';

const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      entry: [raise({ type: 'TIMER' }, { id: 'TIMER1', delay: 10 })],
      on: {
        TIMER: 'yellow',
        KEEP_GOING: {
          actions: [cancel('TIMER1')]
        }
      }
    },
    yellow: {
      entry: [raise({ type: 'TIMER' }, { delay: 10 })],
      on: {
        TIMER: 'red'
      }
    },
    red: {
      after: {
        10: 'green'
      }
    }
  }
});

describe('interpreter', () => {
  describe('initial state', () => {
    it('.getSnapshot returns the initial state', () => {
      const machine = createMachine({
        initial: 'foo',
        states: {
          bar: {},
          foo: {}
        }
      });
      const service = createActor(machine);

      expect(service.getSnapshot().value).toEqual('foo');
    });

    it('initially spawned actors should not be spawned when reading initial state', (done) => {
      let promiseSpawned = 0;

      const machine = createMachine({
        initial: 'idle',
        context: {
          actor: undefined! as ActorRefFrom<PromiseActorLogic<unknown>>
        },
        states: {
          idle: {
            entry: assign({
              actor: ({ spawn }) => {
                return spawn(
                  fromPromise(
                    () =>
                      new Promise(() => {
                        promiseSpawned++;
                      })
                  )
                );
              }
            })
          }
        }
      });

      const service = createActor(machine);

      expect(promiseSpawned).toEqual(0);

      service.getSnapshot();
      service.getSnapshot();
      service.getSnapshot();

      expect(promiseSpawned).toEqual(0);

      service.start();

      setTimeout(() => {
        expect(promiseSpawned).toEqual(1);
        done();
      }, 100);
    });

    it('does not execute actions from a restored state', () => {
      let called = false;
      const machine = createMachine({
        initial: 'green',
        states: {
          green: {
            on: {
              TIMER: {
                target: 'yellow',
                actions: () => (called = true)
              }
            }
          },
          yellow: {
            on: {
              TIMER: {
                target: 'red'
              }
            }
          },
          red: {
            on: {
              TIMER: 'green'
            }
          }
        }
      });

      let actorRef = createActor(machine).start();

      actorRef.send({ type: 'TIMER' });
      called = false;
      const persisted = actorRef.getPersistedState();
      actorRef = createActor(machine, { state: persisted }).start();

      expect(called).toBe(false);
    });

    it('should not execute actions that are not part of the actual persisted state', () => {
      let called = false;
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            entry: () => {
              // this should not be called when starting from a different state
              called = true;
            },
            always: 'b'
          },
          b: {}
        }
      });

      const actorRef = createActor(machine).start();
      called = false;
      expect(actorRef.getSnapshot().value).toEqual('b');
      const persisted = actorRef.getPersistedState();

      createActor(machine, { state: persisted }).start();

      expect(called).toBe(false);
    });
  });

  describe('subscribing', () => {
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {}
      }
    });

    it('should not notify subscribers of the current state upon subscription (subscribe)', () => {
      const spy = jest.fn();
      const service = createActor(machine).start();

      service.subscribe(spy);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('send with delay', () => {
    it('can send an event after a delay', async () => {
      const machine = createMachine({
        initial: 'foo',
        states: {
          foo: {
            entry: [raise({ type: 'TIMER' }, { delay: 10 })],
            on: {
              TIMER: 'bar'
            }
          },
          bar: {}
        }
      });
      const actorRef = createActor(machine);
      expect(actorRef.getSnapshot().value).toBe('foo');

      await new Promise((res) => setTimeout(res, 10));
      expect(actorRef.getSnapshot().value).toBe('foo');

      actorRef.start();
      expect(actorRef.getSnapshot().value).toBe('foo');

      await new Promise((res) => setTimeout(res, 5));
      expect(actorRef.getSnapshot().value).toBe('foo');

      await new Promise((res) => setTimeout(res, 10));
      expect(actorRef.getSnapshot().value).toBe('bar');
    });

    it('can send an event after a delay (expression)', () => {
      interface DelayExprMachineCtx {
        initialDelay: number;
      }

      type DelayExpMachineEvents =
        | { type: 'ACTIVATE'; wait: number }
        | { type: 'FINISH' };

      const delayExprMachine = createMachine({
        types: {} as {
          context: DelayExprMachineCtx;
          events: DelayExpMachineEvents;
        },
        id: 'delayExpr',
        context: {
          initialDelay: 100
        },
        initial: 'idle',
        states: {
          idle: {
            on: {
              ACTIVATE: 'pending'
            }
          },
          pending: {
            entry: raise(
              { type: 'FINISH' },
              {
                delay: ({ context, event }) =>
                  context.initialDelay +
                  ('wait' in event
                    ? (
                        event as Extract<
                          DelayExpMachineEvents,
                          { type: 'ACTIVATE' }
                        >
                      ).wait
                    : 0)
              }
            ),
            on: {
              FINISH: 'finished'
            }
          },
          finished: { type: 'final' }
        }
      });

      let stopped = false;

      const clock = new SimulatedClock();

      const delayExprService = createActor(delayExprMachine, {
        clock
      });
      delayExprService.subscribe({
        complete: () => {
          stopped = true;
        }
      });
      delayExprService.start();

      delayExprService.send({
        type: 'ACTIVATE',
        wait: 50
      });

      clock.increment(101);

      expect(stopped).toBe(false);

      clock.increment(50);

      expect(stopped).toBe(true);
    });

    it('can send an event after a delay (expression using _event)', () => {
      interface DelayExprMachineCtx {
        initialDelay: number;
      }

      type DelayExpMachineEvents =
        | {
            type: 'ACTIVATE';
            wait: number;
          }
        | {
            type: 'FINISH';
          };

      const delayExprMachine = createMachine({
        types: {} as {
          context: DelayExprMachineCtx;
          events: DelayExpMachineEvents;
        },
        id: 'delayExpr',
        context: {
          initialDelay: 100
        },
        initial: 'idle',
        states: {
          idle: {
            on: {
              ACTIVATE: 'pending'
            }
          },
          pending: {
            entry: raise(
              { type: 'FINISH' },
              {
                delay: ({ context, event }) =>
                  context.initialDelay +
                  (
                    event as Extract<
                      DelayExpMachineEvents,
                      { type: 'ACTIVATE' }
                    >
                  ).wait
              }
            ),
            on: {
              FINISH: 'finished'
            }
          },
          finished: {
            type: 'final'
          }
        }
      });

      let stopped = false;

      const clock = new SimulatedClock();

      const delayExprService = createActor(delayExprMachine, {
        clock
      });
      delayExprService.subscribe({
        complete: () => {
          stopped = true;
        }
      });
      delayExprService.start();

      delayExprService.send({
        type: 'ACTIVATE',
        wait: 50
      });

      clock.increment(101);

      expect(stopped).toBe(false);

      clock.increment(50);

      expect(stopped).toBe(true);
    });

    it('can send an event after a delay (delayed transitions)', (done) => {
      const clock = new SimulatedClock();
      const letterMachine = createMachine(
        {
          types: {} as {
            events: { type: 'FIRE_DELAY'; value: number };
          },
          id: 'letter',
          context: {
            delay: 100
          },
          initial: 'a',
          states: {
            a: {
              after: {
                delayA: 'b'
              }
            },
            b: {
              after: {
                someDelay: 'c'
              }
            },
            c: {
              entry: raise({ type: 'FIRE_DELAY', value: 200 }, { delay: 20 }),
              on: {
                FIRE_DELAY: 'd'
              }
            },
            d: {
              after: {
                delayD: 'e'
              }
            },
            e: {
              after: { someDelay: 'f' }
            },
            f: {
              type: 'final'
            }
          }
        },
        {
          delays: {
            someDelay: ({ context }) => {
              return context.delay + 50;
            },
            delayA: ({ context }) => context.delay,
            delayD: ({ context, event }) => context.delay + (event as any).value
          }
        }
      );

      const actor = createActor(letterMachine, { clock });
      actor.subscribe({
        complete: () => {
          done();
        }
      });
      actor.start();

      expect(actor.getSnapshot().value).toEqual('a');
      clock.increment(100);
      expect(actor.getSnapshot().value).toEqual('b');
      clock.increment(100 + 50);
      expect(actor.getSnapshot().value).toEqual('c');
      clock.increment(20);
      expect(actor.getSnapshot().value).toEqual('d');
      clock.increment(100 + 200);
      expect(actor.getSnapshot().value).toEqual('e');
      clock.increment(100 + 50);
    });
  });

  describe('activities (deprecated)', () => {
    it('should start activities', () => {
      const spy = jest.fn();

      const activityMachine = createMachine(
        {
          id: 'activity',
          initial: 'on',
          states: {
            on: {
              invoke: {
                src: 'myActivity'
              },
              on: {
                TURN_OFF: 'off'
              }
            },
            off: {}
          }
        },
        {
          actors: {
            myActivity: fromCallback(spy)
          }
        }
      );
      const service = createActor(activityMachine);

      service.start();

      expect(spy).toHaveBeenCalled();
    });

    it('should stop activities', () => {
      const spy = jest.fn();

      const activityMachine = createMachine(
        {
          id: 'activity',
          initial: 'on',
          states: {
            on: {
              invoke: {
                src: 'myActivity'
              },
              on: {
                TURN_OFF: 'off'
              }
            },
            off: {}
          }
        },
        {
          actors: {
            myActivity: fromCallback(() => spy)
          }
        }
      );
      const service = createActor(activityMachine);

      service.start();

      expect(spy).not.toHaveBeenCalled();

      service.send({ type: 'TURN_OFF' });

      expect(spy).toHaveBeenCalled();
    });

    it('should stop activities upon stopping the service', () => {
      const spy = jest.fn();

      const stopActivityMachine = createMachine(
        {
          id: 'stopActivity',
          initial: 'on',
          states: {
            on: {
              invoke: {
                src: 'myActivity'
              },
              on: {
                TURN_OFF: 'off'
              }
            },
            off: {}
          }
        },
        {
          actors: {
            myActivity: fromCallback(() => spy)
          }
        }
      );

      const stopActivityService = createActor(stopActivityMachine).start();

      expect(spy).not.toHaveBeenCalled();

      stopActivityService.stop();

      expect(spy).toHaveBeenCalled();
    });

    it('should restart activities from a compound state', () => {
      let activityActive = false;

      const machine = createMachine(
        {
          initial: 'inactive',
          states: {
            inactive: {
              on: { TOGGLE: 'active' }
            },
            active: {
              invoke: { src: 'blink' },
              on: { TOGGLE: 'inactive' },
              initial: 'A',
              states: {
                A: { on: { SWITCH: 'B' } },
                B: { on: { SWITCH: 'A' } }
              }
            }
          }
        },
        {
          actors: {
            blink: fromCallback(() => {
              activityActive = true;
              return () => {
                activityActive = false;
              };
            })
          }
        }
      );

      const actorRef = createActor(machine).start();
      actorRef.send({ type: 'TOGGLE' });
      actorRef.send({ type: 'SWITCH' });
      const bState = actorRef.getPersistedState();
      actorRef.stop();
      activityActive = false;

      createActor(machine, { state: bState }).start();

      expect(activityActive).toBeTruthy();
    });
  });

  it('can cancel a delayed event', () => {
    const service = createActor(lightMachine, {
      clock: new SimulatedClock()
    });
    const clock = service.clock as SimulatedClock;
    service.start();

    clock.increment(5);
    service.send({ type: 'KEEP_GOING' });

    expect(service.getSnapshot().value).toEqual('green');
    clock.increment(10);
    expect(service.getSnapshot().value).toEqual('green');
  });

  it('can cancel a delayed event using expression to resolve send id', (done) => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          entry: [
            raise(
              { type: 'FOO' },
              {
                id: 'foo',
                delay: 100
              }
            ),
            raise(
              { type: 'BAR' },
              {
                delay: 200
              }
            ),
            cancel(() => 'foo')
          ],
          on: {
            FOO: 'fail',
            BAR: 'pass'
          }
        },
        fail: {
          type: 'final'
        },
        pass: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();

    service.subscribe({
      complete: () => {
        expect(service.getSnapshot().value).toBe('pass');
        done();
      }
    });
  });

  it('should not throw an error if an event is sent to an uninitialized interpreter', () => {
    const actorRef = createActor(lightMachine);

    expect(() => actorRef.send({ type: 'SOME_EVENT' })).not.toThrow();
  });

  it('should defer events sent to an uninitialized service', (done) => {
    const deferMachine = createMachine({
      id: 'defer',
      initial: 'a',
      states: {
        a: {
          on: { NEXT_A: 'b' }
        },
        b: {
          on: { NEXT_B: 'c' }
        },
        c: {
          type: 'final'
        }
      }
    });

    let state: any;
    const deferService = createActor(deferMachine);

    deferService.subscribe({
      next: (nextState) => {
        state = nextState;
      },
      complete: done
    });

    // uninitialized
    deferService.send({ type: 'NEXT_A' });
    deferService.send({ type: 'NEXT_B' });

    expect(state).not.toBeDefined();

    // initialized
    deferService.start();
  });

  // TODO: figure out how to rewrite this test case or revert some changes
  it.skip('should throw an error if initial state sent to interpreter is invalid', () => {
    const invalidMachine = {
      id: 'fetchMachine',
      initial: 'create',
      states: {
        edit: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                FETCH: 'pending'
              }
            },
            pending: {}
          }
        }
      }
    };

    expect(() => {
      createActor(createMachine(invalidMachine)).start();
    }).toThrowErrorMatchingInlineSnapshot(
      `"Initial state node "create" not found on parent state node #fetchMachine"`
    );
  });

  it('should not update when stopped', () => {
    const service = createActor(lightMachine, {
      clock: new SimulatedClock()
    });

    service.start();
    service.send({ type: 'TIMER' }); // yellow
    expect(service.getSnapshot().value).toEqual('yellow');

    service.stop();
    try {
      service.send({ type: 'TIMER' }); // red if interpreter is not stopped
    } catch (e) {
      expect(service.getSnapshot().value).toEqual('yellow');
    }

    expect(console.warn).toMatchMockCallsInlineSnapshot(`
      [
        [
          "Event "TIMER" was sent to stopped actor "x:26 (x:26)". This actor has already reached its final state, and will not transition.
      Event: {"type":"TIMER"}",
        ],
      ]
    `);
  });

  it('should be able to log (log action)', () => {
    const logs: any[] = [];

    const logMachine = createMachine({
      types: {} as { context: { count: number } },
      id: 'log',
      initial: 'x',
      context: { count: 0 },
      states: {
        x: {
          on: {
            LOG: {
              actions: [
                assign({ count: ({ context }) => context.count + 1 }),
                log(({ context }) => context)
              ]
            }
          }
        }
      }
    });

    const service = createActor(logMachine, {
      logger: (msg) => logs.push(msg)
    }).start();

    service.send({ type: 'LOG' });
    service.send({ type: 'LOG' });

    expect(logs.length).toBe(2);
    expect(logs).toEqual([{ count: 1 }, { count: 2 }]);
  });

  it('should receive correct event (log action)', () => {
    const logs: any[] = [];
    const logAction = log(({ event }) => event.type);

    const parentMachine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            EXTERNAL_EVENT: {
              actions: [raise({ type: 'RAISED_EVENT' }), logAction]
            }
          }
        }
      },
      on: {
        '*': {
          actions: [logAction]
        }
      }
    });

    const service = createActor(parentMachine, {
      logger: (msg) => logs.push(msg)
    }).start();

    service.send({ type: 'EXTERNAL_EVENT' });

    expect(logs.length).toBe(2);
    expect(logs).toEqual(['EXTERNAL_EVENT', 'RAISED_EVENT']);
  });

  describe('send() event expressions', () => {
    interface Ctx {
      password: string;
    }
    interface Events {
      type: 'NEXT';
      password: string;
    }
    const machine = createMachine({
      types: {} as { context: Ctx; events: Events },
      id: 'sendexpr',
      initial: 'start',
      context: {
        password: 'foo'
      },
      states: {
        start: {
          entry: raise(({ context }) => ({
            type: 'NEXT' as const,
            password: context.password
          })),
          on: {
            NEXT: {
              target: 'finish',
              guard: ({ event }) => event.password === 'foo'
            }
          }
        },
        finish: {
          type: 'final'
        }
      }
    });

    it('should resolve send event expressions', (done) => {
      const actor = createActor(machine);
      actor.subscribe({ complete: () => done() });
      actor.start();
    });
  });

  describe('sendParent() event expressions', () => {
    it('should resolve sendParent event expressions', (done) => {
      const childMachine = createMachine({
        types: {} as {
          context: { password: string };
          input: { password: string };
        },
        id: 'child',
        initial: 'start',
        context: ({ input }) => ({
          password: input.password
        }),
        states: {
          start: {
            entry: sendParent(({ context }) => {
              return { type: 'NEXT', password: context.password };
            })
          }
        }
      });

      const parentMachine = createMachine({
        types: {} as {
          events: {
            type: 'NEXT';
            password: string;
          };
        },
        id: 'parent',
        initial: 'start',
        states: {
          start: {
            invoke: {
              id: 'child',
              src: childMachine,
              input: { password: 'foo' }
            },
            on: {
              NEXT: {
                target: 'finish',
                guard: ({ event }) => event.password === 'foo'
              }
            }
          },
          finish: {
            type: 'final'
          }
        }
      });

      const actor = createActor(parentMachine);
      actor.subscribe({
        next: (state) => {
          if (state.matches('start')) {
            const childActor = state.children.child;

            expect(typeof childActor!.send).toBe('function');
          }
        },
        complete: () => done()
      });
      actor.start();
    });
  });

  describe('.send()', () => {
    const sendMachine = createMachine({
      id: 'send',
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            EVENT: {
              target: 'active',
              guard: ({ event }) => event.id === 42 // TODO: fix unknown event type
            },
            ACTIVATE: 'active'
          }
        },
        active: {
          type: 'final'
        }
      }
    });

    it('can send events with a string', (done) => {
      const service = createActor(sendMachine);
      service.subscribe({ complete: () => done() });
      service.start();

      service.send({ type: 'ACTIVATE' });
    });

    it('can send events with an object', (done) => {
      const service = createActor(sendMachine);
      service.subscribe({ complete: () => done() });
      service.start();

      service.send({ type: 'ACTIVATE' });
    });

    it('can send events with an object with payload', (done) => {
      const service = createActor(sendMachine);
      service.subscribe({ complete: () => done() });
      service.start();

      service.send({ type: 'EVENT', id: 42 });
    });

    it('should receive and process all events sent simultaneously', (done) => {
      const toggleMachine = createMachine({
        id: 'toggle',
        initial: 'inactive',
        states: {
          fail: {},
          inactive: {
            on: {
              INACTIVATE: 'fail',
              ACTIVATE: 'active'
            }
          },
          active: {
            on: {
              INACTIVATE: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const toggleService = createActor(toggleMachine);
      toggleService.subscribe({
        complete: () => {
          done();
        }
      });
      toggleService.start();

      toggleService.send({ type: 'ACTIVATE' });
      toggleService.send({ type: 'INACTIVATE' });
    });
  });

  describe('.start()', () => {
    it('should initialize the service', () => {
      const contextSpy = jest.fn();
      const entrySpy = jest.fn();

      const machine = createMachine({
        context: contextSpy,
        entry: entrySpy,
        initial: 'foo',
        states: {
          foo: {}
        }
      });
      const actor = createActor(machine);
      actor.start();

      expect(contextSpy).toHaveBeenCalled();
      expect(entrySpy).toHaveBeenCalled();
      expect(actor.getSnapshot()).toBeDefined();
      expect(actor.getSnapshot().matches('foo')).toBeTruthy();
    });

    it('should not reinitialize a started service', () => {
      const contextSpy = jest.fn();
      const entrySpy = jest.fn();

      const machine = createMachine({
        context: contextSpy,
        entry: entrySpy
      });
      const actor = createActor(machine);
      actor.start();
      actor.start();

      expect(contextSpy).toHaveBeenCalledTimes(1);
      expect(entrySpy).toHaveBeenCalledTimes(1);
    });

    it('should be able to be initialized at a custom state', () => {
      const machine = createMachine({
        initial: 'foo',
        states: {
          foo: {},
          bar: {}
        }
      });
      const actor = createActor(machine, {
        state: machine.resolveState({ value: 'bar' })
      });

      expect(actor.getSnapshot().matches('bar')).toBeTruthy();
      actor.start();
      expect(actor.getSnapshot().matches('bar')).toBeTruthy();
    });

    it('should be able to be initialized at a custom state value', () => {
      const machine = createMachine({
        initial: 'foo',
        states: {
          foo: {},
          bar: {}
        }
      });
      const actor = createActor(machine, {
        state: machine.resolveState({ value: 'bar' })
      });

      expect(actor.getSnapshot().matches('bar')).toBeTruthy();
      actor.start();
      expect(actor.getSnapshot().matches('bar')).toBeTruthy();
    });

    it('should be able to resolve a custom initialized state', () => {
      const machine = createMachine({
        id: 'start',
        initial: 'foo',
        states: {
          foo: {
            initial: 'one',
            states: {
              one: {}
            }
          },
          bar: {}
        }
      });
      const actor = createActor(machine, {
        state: machine.resolveState({ value: 'foo' })
      });

      expect(actor.getSnapshot().matches({ foo: 'one' })).toBeTruthy();
      actor.start();
      expect(actor.getSnapshot().matches({ foo: 'one' })).toBeTruthy();
    });
  });

  describe('.stop()', () => {
    it('should cancel delayed events', (done) => {
      let called = false;
      const delayedMachine = createMachine({
        id: 'delayed',
        initial: 'foo',
        states: {
          foo: {
            after: {
              50: {
                target: 'bar',
                actions: () => {
                  called = true;
                }
              }
            }
          },
          bar: {}
        }
      });

      const delayedService = createActor(delayedMachine).start();

      delayedService.stop();

      setTimeout(() => {
        expect(called).toBe(false);
        done();
      }, 60);
    });

    it('should not execute transitions after being stopped', (done) => {
      let called = false;

      const testMachine = createMachine({
        initial: 'waiting',
        states: {
          waiting: {
            on: {
              TRIGGER: 'active'
            }
          },
          active: {
            entry: () => {
              called = true;
            }
          }
        }
      });

      const service = createActor(testMachine).start();

      service.stop();

      service.send({ type: 'TRIGGER' });

      setTimeout(() => {
        expect(called).toBeFalsy();
        expect(console.warn).toMatchMockCallsInlineSnapshot(`
          [
            [
              "Event "TRIGGER" was sent to stopped actor "x:42 (x:42)". This actor has already reached its final state, and will not transition.
          Event: {"type":"TRIGGER"}",
            ],
          ]
        `);
        done();
      }, 10);
    });

    it('stopping a not-started interpreter should not crash', () => {
      const service = createActor(
        createMachine({
          initial: 'a',
          states: { a: {} }
        })
      );

      expect(() => {
        service.stop();
      }).not.toThrow();
    });
  });

  describe('.unsubscribe()', () => {
    it('should remove transition listeners', () => {
      const toggleMachine = createMachine({
        id: 'toggle',
        initial: 'inactive',
        states: {
          inactive: {
            on: { TOGGLE: 'active' }
          },
          active: {
            on: { TOGGLE: 'inactive' }
          }
        }
      });

      const toggleService = createActor(toggleMachine).start();

      let stateCount = 0;

      const listener = () => stateCount++;

      const sub = toggleService.subscribe(listener);

      expect(stateCount).toEqual(0);

      toggleService.send({ type: 'TOGGLE' });

      expect(stateCount).toEqual(1);

      toggleService.send({ type: 'TOGGLE' });

      expect(stateCount).toEqual(2);

      sub.unsubscribe();
      toggleService.send({ type: 'TOGGLE' });

      expect(stateCount).toEqual(2);
    });
  });

  describe('transient states', () => {
    it('should transition in correct order', () => {
      const stateMachine = createMachine({
        id: 'transient',
        initial: 'idle',
        states: {
          idle: { on: { START: 'transient' } },
          transient: { always: 'next' },
          next: { on: { FINISH: 'end' } },
          end: { type: 'final' }
        }
      });

      const stateValues: StateValue[] = [];
      const service = createActor(stateMachine);
      service.subscribe((current) => stateValues.push(current.value));
      service.start();
      service.send({ type: 'START' });

      const expectedStateValues = ['idle', 'next'];
      expect(stateValues.length).toEqual(expectedStateValues.length);
      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });

    it('should transition in correct order when there is a condition', () => {
      const stateMachine = createMachine(
        {
          id: 'transient',
          initial: 'idle',
          states: {
            idle: { on: { START: 'transient' } },
            transient: {
              always: [
                { target: 'end', guard: 'alwaysFalse' },
                { target: 'next' }
              ]
            },
            next: { on: { FINISH: 'end' } },
            end: { type: 'final' }
          }
        },
        {
          guards: {
            alwaysFalse: () => false
          }
        }
      );

      const stateValues: StateValue[] = [];
      const service = createActor(stateMachine);
      service.subscribe((current) => stateValues.push(current.value));
      service.start();
      service.send({ type: 'START' });

      const expectedStateValues = ['idle', 'next'];
      expect(stateValues.length).toEqual(expectedStateValues.length);
      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });
  });

  describe('observable', () => {
    const context = { count: 0 };
    const intervalMachine = createMachine({
      id: 'interval',
      types: {} as { context: typeof context },
      context,
      initial: 'active',
      states: {
        active: {
          after: {
            10: {
              target: 'active',
              reenter: true,
              actions: assign({
                count: ({ context }) => context.count + 1
              })
            }
          },
          always: {
            target: 'finished',
            guard: ({ context }) => context.count >= 5
          }
        },
        finished: {
          type: 'final'
        }
      }
    });

    it('should be subscribable', (done) => {
      let count: number;
      const intervalService = createActor(intervalMachine).start();

      expect(isObservable(intervalService)).toBeTruthy();

      intervalService.subscribe(
        (state) => (count = state.context.count),
        undefined,
        () => {
          expect(count).toEqual(5);
          done();
        }
      );
    });

    it('should be interoperable with RxJS, etc. via Symbol.observable', (done) => {
      let count = 0;
      const intervalService = createActor(intervalMachine).start();

      expect(() => {
        const state$ = from(intervalService);

        state$.subscribe({
          next: () => {
            count += 1;
          },
          error: undefined,
          complete: () => {
            expect(count).toEqual(5);
            done();
          }
        });
      }).not.toThrow();
    });

    it('should be unsubscribable', (done) => {
      const countContext = { count: 0 };
      const machine = createMachine({
        types: {} as { context: typeof countContext },
        context: countContext,
        initial: 'active',
        states: {
          active: {
            always: {
              target: 'finished',
              guard: ({ context }) => context.count >= 5
            },
            on: {
              INC: {
                actions: assign({ count: ({ context }) => context.count + 1 })
              }
            }
          },
          finished: {
            type: 'final'
          }
        }
      });

      let count: number;
      const service = createActor(machine);
      service.subscribe({
        complete: () => {
          expect(count).toEqual(2);
          done();
        }
      });
      service.start();

      const subscription = service.subscribe(
        (state) => (count = state.context.count)
      );

      service.send({ type: 'INC' });
      service.send({ type: 'INC' });
      subscription.unsubscribe();
      service.send({ type: 'INC' });
      service.send({ type: 'INC' });
      service.send({ type: 'INC' });
    });

    it('should call complete() once a final state is reached', () => {
      const completeCb = jest.fn();

      const service = createActor(
        createMachine({
          initial: 'idle',
          states: {
            idle: {
              on: {
                NEXT: 'done'
              }
            },
            done: { type: 'final' }
          }
        })
      ).start();

      service.subscribe({
        complete: completeCb
      });

      service.send({ type: 'NEXT' });

      expect(completeCb).toHaveBeenCalledTimes(1);
    });

    it('should call complete() once the interpreter is stopped', () => {
      const completeCb = jest.fn();

      const service = createActor(createMachine({})).start();

      service.subscribe({
        complete: () => {
          completeCb();
        }
      });

      service.stop();

      expect(completeCb).toHaveBeenCalledTimes(1);
    });
  });

  describe('actors', () => {
    it("doesn't crash cryptically on undefined return from the actor creator", () => {
      const child = fromCallback(() => {
        // nothing
      });
      const machine = createMachine(
        {
          types: {} as {
            actors: {
              src: 'testService';
              logic: typeof child;
            };
          },
          initial: 'initial',
          states: {
            initial: {
              invoke: {
                src: 'testService'
              }
            }
          }
        },
        {
          actors: {
            testService: child
          }
        }
      );

      const service = createActor(machine);
      expect(() => service.start()).not.toThrow();
    });
  });

  describe('children', () => {
    it('state.children should reference invoked child actors (machine)', () => {
      const childMachine = createMachine({
        initial: 'active',
        states: {
          active: {
            on: {
              FIRE: {
                actions: sendParent({ type: 'FIRED' })
              }
            }
          }
        }
      });
      const parentMachine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'childActor',
              src: childMachine
            },
            on: {
              FIRED: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const actor = createActor(parentMachine);
      actor.start();
      actor.getSnapshot().children.childActor.send({ type: 'FIRE' });

      // the actor should be done by now
      expect(actor.getSnapshot().children).not.toHaveProperty('childActor');
    });

    it('state.children should reference invoked child actors (promise)', (done) => {
      const parentMachine = createMachine(
        {
          initial: 'active',
          types: {} as {
            actors: {
              src: 'num';
              logic: PromiseActorLogic<number>;
            };
          },
          states: {
            active: {
              invoke: {
                id: 'childActor',
                src: 'num',
                onDone: [
                  {
                    target: 'success',
                    guard: ({ event }) => {
                      return event.output === 42;
                    }
                  },
                  { target: 'failure' }
                ]
              }
            },
            success: {
              type: 'final'
            },
            failure: {
              type: 'final'
            }
          }
        },
        {
          actors: {
            num: fromPromise(
              () =>
                new Promise<number>((res) => {
                  setTimeout(() => {
                    res(42);
                  }, 100);
                })
            )
          }
        }
      );

      const service = createActor(parentMachine);

      service.subscribe({
        next: (state) => {
          if (state.matches('active')) {
            const childActor = state.children.childActor;

            expect(childActor).toHaveProperty('send');
          }
        },
        complete: () => {
          expect(service.getSnapshot().matches('success')).toBeTruthy();
          expect(service.getSnapshot().children).not.toHaveProperty(
            'childActor'
          );
          done();
        }
      });

      service.start();
    });

    it('state.children should reference invoked child actors (observable)', (done) => {
      const interval$ = interval(10);
      const intervalLogic = fromObservable(() => interval$);

      const parentMachine = createMachine(
        {
          types: {} as {
            actors: {
              src: 'intervalLogic';
              logic: typeof intervalLogic;
            };
          },
          initial: 'active',
          states: {
            active: {
              invoke: {
                id: 'childActor',
                src: 'intervalLogic',
                onSnapshot: {
                  target: 'success',
                  guard: ({ event }) => {
                    return event.snapshot.context === 3;
                  }
                }
              }
            },
            success: {
              type: 'final'
            }
          }
        },
        {
          actors: {
            intervalLogic
          }
        }
      );

      const service = createActor(parentMachine);
      service.subscribe({
        complete: () => {
          expect(service.getSnapshot().children).not.toHaveProperty(
            'childActor'
          );
          done();
        }
      });

      service.subscribe((state) => {
        if (state.matches('active')) {
          expect(state.children['childActor']).not.toBeUndefined();
        }
      });

      service.start();
    });

    it('state.children should reference spawned actors', () => {
      const childMachine = createMachine({
        initial: 'idle',
        states: {
          idle: {}
        }
      });
      const formMachine = createMachine({
        id: 'form',
        initial: 'idle',
        context: {},
        entry: assign({
          firstNameRef: ({ spawn }) => spawn(childMachine, { id: 'child' })
        }),
        states: {
          idle: {}
        }
      });

      const actor = createActor(formMachine);
      actor.start();
      expect(actor.getSnapshot().children).toHaveProperty('child');
    });

    it('stopped spawned actors should be cleaned up in parent', () => {
      const childMachine = createMachine({
        initial: 'idle',
        states: {
          idle: {}
        }
      });

      const parentMachine = createMachine({
        id: 'form',
        initial: 'present',
        context: {} as {
          machineRef: ActorRefFrom<typeof childMachine>;
          promiseRef: ActorRefFrom<typeof fromPromise>;
          observableRef: ActorRef<any, any>;
        },
        entry: assign({
          machineRef: ({ spawn }) =>
            spawn(childMachine, { id: 'machineChild' }),
          promiseRef: ({ spawn }) =>
            spawn(
              fromPromise(
                () =>
                  new Promise(() => {
                    // ...
                  })
              ),
              { id: 'promiseChild' }
            ),
          observableRef: ({ spawn }) =>
            spawn(
              fromObservable(() => interval(1000)),
              { id: 'observableChild' }
            )
        }),
        states: {
          present: {
            on: {
              NEXT: {
                target: 'gone',
                actions: [
                  stop(({ context }) => context.machineRef),
                  stop(({ context }) => context.promiseRef),
                  stop(({ context }) => context.observableRef)
                ]
              }
            }
          },
          gone: {
            type: 'final'
          }
        }
      });

      const service = createActor(parentMachine).start();

      expect(service.getSnapshot().children).toHaveProperty('machineChild');
      expect(service.getSnapshot().children).toHaveProperty('promiseChild');
      expect(service.getSnapshot().children).toHaveProperty('observableChild');

      service.send({ type: 'NEXT' });

      expect(service.getSnapshot().children.machineChild).toBeUndefined();
      expect(service.getSnapshot().children.promiseChild).toBeUndefined();
      expect(service.getSnapshot().children.observableChild).toBeUndefined();
    });
  });

  it("shouldn't execute actions when reading a snapshot of not started actor", () => {
    const spy = jest.fn();
    const actorRef = createActor(
      createMachine({
        entry: () => {
          spy();
        }
      })
    );

    actorRef.getSnapshot();

    expect(spy).not.toHaveBeenCalled();
  });

  it(`should execute entry actions when starting the actor after reading its snapshot first`, () => {
    const spy = jest.fn();

    const actorRef = createActor(
      createMachine({
        entry: spy
      })
    );

    actorRef.getSnapshot();
    expect(spy).not.toHaveBeenCalled();

    actorRef.start();

    expect(spy).toHaveBeenCalled();
  });

  it('the first state of an actor should be its initial state', () => {
    const machine = createMachine({});
    const actor = createActor(machine);
    const initialState = actor.getSnapshot();

    actor.start();

    expect(actor.getSnapshot()).toBe(initialState);
  });

  it('should call an onDone callback immediately if the service is already done', (done) => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();

    expect(service.getSnapshot().status).toBe('done');

    service.subscribe({
      complete: () => {
        done();
      }
    });
  });
});

it('should throw if an event is received', () => {
  const machine = createMachine({});

  const actor = createActor(machine).start();

  expect(() =>
    actor.send(
      // @ts-ignore
      'EVENT'
    )
  ).toThrow();
});

it('should not process events sent directly to own actor ref before initial entry actions are processed', () => {
  const actual: string[] = [];
  const machine = createMachine({
    entry: () => {
      actual.push('initial root entry start');
      actorRef.send({
        type: 'EV'
      });
      actual.push('initial root entry end');
    },
    on: {
      EV: {
        actions: () => {
          actual.push('EV transition');
        }
      }
    },
    initial: 'a',
    states: {
      a: {
        entry: () => {
          actual.push('initial nested entry');
        }
      }
    }
  });

  const actorRef = createActor(machine);
  actorRef.start();

  expect(actual).toEqual([
    'initial root entry start',
    'initial root entry end',
    'initial nested entry',
    'EV transition'
  ]);
});
