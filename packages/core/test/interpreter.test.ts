import { SimulatedClock } from '../src/SimulatedClock';
import { machine as idMachine } from './fixtures/id';
import {
  interpret,
  assign,
  sendParent,
  StateValue,
  createMachine,
  AnyState,
  InterpreterStatus,
  ActorRefFrom,
  ActorRef,
  cancel,
  raise,
  sendTo,
  stop,
  log
} from '../src/index.ts';
import { State } from '../src/State';
import { isObservable } from '../src/utils';
import { interval, from } from 'rxjs';
import { fromObservable } from '../src/actors/observable';
import { fromPromise } from '../src/actors/promise';
import { fromCallback } from '../src/actors/callback';
import { respond } from '../src/actions.ts';

const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      entry: [raise({ type: 'TIMER' }, { delay: 10 })],
      on: {
        TIMER: 'yellow',
        KEEP_GOING: {
          actions: [cancel('TIMER')]
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
      const service = interpret(idMachine);

      expect(service.getSnapshot().value).toEqual(
        idMachine.getInitialState().value
      );
    });

    it('initially spawned actors should not be spawned when reading initial state', (done) => {
      let promiseSpawned = 0;

      const machine = createMachine({
        initial: 'idle',
        context: {
          actor: undefined! as ActorRefFrom<ReturnType<typeof fromPromise>>
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

      const service = interpret(machine);

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
      const reportSpy = jest.fn();
      const lightMachine = createMachine({
        id: 'light',
        initial: 'green',
        states: {
          green: {
            on: {
              TIMER: {
                target: 'yellow',
                actions: reportSpy
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

      const currentState = 'green';
      const nextState = lightMachine.transition(currentState, {
        type: 'TIMER'
      });

      // saves state and recreate it
      const recreated = JSON.parse(JSON.stringify(nextState));
      const restoredState = lightMachine.createState(recreated);

      const service = interpret(lightMachine, { state: restoredState });
      service.start();

      expect(reportSpy).not.toHaveBeenCalled();
    });

    it('should not execute actions that are not part of the actual persisted state', () => {
      let aCalled = false;
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            entry: () => {
              // this should not be called when starting from a different state
              aCalled = true;
            },
            always: 'b'
          },
          b: {}
        }
      });

      const bState = machine.initialState;

      expect(bState.value).toEqual('b');

      interpret(machine, { state: machine.resolveStateValue('b') }).start();

      expect(aCalled).toBe(false);
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
      const service = interpret(machine).start();

      service.subscribe(spy);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('send with delay', () => {
    it('can send an event after a delay', () => {
      const currentStates: Array<AnyState> = [];

      const service = interpret(lightMachine, {
        clock: new SimulatedClock()
      });
      service.subscribe((state) => {
        currentStates.push(state);

        if (currentStates.length === 4) {
          expect(currentStates.map((s) => s.value)).toEqual([
            'green',
            'yellow',
            'red',
            'green'
          ]);
        }
      });
      const clock = service.clock as SimulatedClock;
      service.start();

      clock.increment(5);
      expect(currentStates[0]!.value).toEqual('green');

      clock.increment(5);
      expect(currentStates.map((s) => s.value)).toEqual(['green', 'yellow']);

      clock.increment(5);
      expect(currentStates.map((s) => s.value)).toEqual(['green', 'yellow']);

      clock.increment(5);
      expect(currentStates.map((s) => s.value)).toEqual([
        'green',
        'yellow',
        'red'
      ]);

      clock.increment(5);
      expect(currentStates.map((s) => s.value)).toEqual([
        'green',
        'yellow',
        'red'
      ]);

      clock.increment(5);
      expect(currentStates.map((s) => s.value)).toEqual([
        'green',
        'yellow',
        'red',
        'green'
      ]);
    });

    it('can send an event after a delay (expression)', () => {
      interface DelayExprMachineCtx {
        initialDelay: number;
      }

      type DelayExpMachineEvents =
        | { type: 'ACTIVATE'; wait: number }
        | { type: 'FINISH' };

      const delayExprMachine = createMachine<
        DelayExprMachineCtx,
        DelayExpMachineEvents
      >({
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

      const delayExprService = interpret(delayExprMachine, {
        clock
      })
        .onDone(() => {
          stopped = true;
        })
        .start();

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

      const delayExprMachine = createMachine<
        DelayExprMachineCtx,
        DelayExpMachineEvents
      >({
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
                delay: ({ context, _event }) =>
                  context.initialDelay +
                  (
                    _event.data as Extract<
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

      const delayExprService = interpret(delayExprMachine, {
        clock
      })
        .onDone(() => {
          stopped = true;
        })
        .start();

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
          id: 'letter',
          context: {
            delay: 100
          },
          initial: 'a',
          states: {
            a: {
              after: [
                {
                  delay: ({ context }) => context.delay,
                  target: 'b'
                }
              ]
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
              after: [
                {
                  delay: ({ context, event }) =>
                    context.delay + (event as any).value,
                  target: 'e'
                }
              ]
            },
            e: {
              after: [
                {
                  delay: 'someDelay',
                  target: 'f'
                }
              ]
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
            }
          }
        }
      );

      const actor = interpret(letterMachine, { clock })
        .onDone(() => {
          done();
        })
        .start();

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
    let activityState = 'off';

    const activityMachine = createMachine(
      {
        id: 'activity',
        initial: 'on',
        states: {
          on: {
            invoke: 'myActivity',
            on: {
              TURN_OFF: 'off'
            }
          },
          off: {}
        }
      },
      {
        actors: {
          myActivity: fromCallback(() => {
            activityState = 'on';
            return () => (activityState = 'off');
          })
        }
      }
    );

    it('should start activities', () => {
      const service = interpret(activityMachine);

      service.start();

      expect(activityState).toEqual('on');
    });

    it('should stop activities', () => {
      const service = interpret(activityMachine);

      service.start();

      expect(activityState).toEqual('on');

      service.send({ type: 'TURN_OFF' });

      expect(activityState).toEqual('off');
    });

    it('should stop activities upon stopping the service', () => {
      let stopActivityState: string;

      const stopActivityMachine = createMachine(
        {
          id: 'stopActivity',
          initial: 'on',
          states: {
            on: {
              invoke: 'myActivity',
              on: {
                TURN_OFF: 'off'
              }
            },
            off: {}
          }
        },
        {
          actors: {
            myActivity: fromCallback(() => {
              stopActivityState = 'on';
              return () => (stopActivityState = 'off');
            })
          }
        }
      );

      const stopActivityService = interpret(stopActivityMachine).start();

      expect(stopActivityState!).toEqual('on');

      stopActivityService.stop();

      expect(stopActivityState!).toEqual('off');
    });

    it('should restart activities from a compound state', (done) => {
      let activityActive = false;

      const toggleMachine = createMachine(
        {
          id: 'toggle',
          initial: 'inactive',
          states: {
            inactive: {
              on: { TOGGLE: 'active' }
            },
            active: {
              invoke: 'blink',
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

      const activeState = toggleMachine.transition(toggleMachine.initialState, {
        type: 'TOGGLE'
      });
      const bState = toggleMachine.transition(activeState, { type: 'SWITCH' });

      interpret(toggleMachine, { state: bState }).start();

      setTimeout(() => {
        expect(activityActive).toBeTruthy();
        done();
      }, 10);
    });
  });

  it('can cancel a delayed event', () => {
    const service = interpret(lightMachine, {
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

    const service = interpret(machine).start();

    service.onDone(() => {
      expect(service.getSnapshot().value).toBe('pass');
      done();
    });
  });

  it('should throw an error if an event is sent to an uninitialized interpreter if { deferEvents: false }', () => {
    const service = interpret(lightMachine, {
      clock: new SimulatedClock(),
      deferEvents: false
    });

    expect(() => service.send({ type: 'SOME_EVENT' })).toThrowError(
      /uninitialized/
    );

    service.start();

    expect(() => service.send({ type: 'SOME_EVENT' })).not.toThrow();
  });

  it('should not throw an error if an event is sent to an uninitialized interpreter if { deferEvents: true }', () => {
    const service = interpret(lightMachine, {
      clock: new SimulatedClock(),
      deferEvents: true
    });

    expect(() => service.send({ type: 'SOME_EVENT' })).not.toThrow();

    service.start();

    expect(() => service.send({ type: 'SOME_EVENT' })).not.toThrow();
  });

  it('should not throw an error if an event is sent to an uninitialized interpreter (default options)', () => {
    const service = interpret(lightMachine, {
      clock: new SimulatedClock()
    });

    expect(() => service.send({ type: 'SOME_EVENT' })).not.toThrow();

    service.start();

    expect(() => service.send({ type: 'SOME_EVENT' })).not.toThrow();
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
    const deferService = interpret(deferMachine).onDone(() => done());

    deferService.subscribe((nextState) => {
      state = nextState;
    });

    // uninitialized
    deferService.send({ type: 'NEXT_A' });
    deferService.send({ type: 'NEXT_B' });

    expect(state).not.toBeDefined();

    // initialized
    deferService.start();
  });

  it('should throw an error if initial state sent to interpreter is invalid', () => {
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
      interpret(createMachine(invalidMachine)).start();
    }).toThrowErrorMatchingInlineSnapshot(
      `"Initial state node "create" not found on parent state node #fetchMachine"`
    );
  });

  it('should not update when stopped', () => {
    const service = interpret(lightMachine, {
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
  });

  it('should be able to log (log action)', () => {
    const logs: any[] = [];

    const logMachine = createMachine<{ count: number }>({
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

    const service = interpret(logMachine, {
      logger: (msg) => logs.push(msg)
    }).start();

    service.send({ type: 'LOG' });
    service.send({ type: 'LOG' });

    expect(logs.length).toBe(2);
    expect(logs).toEqual([{ count: 1 }, { count: 2 }]);
  });

  it('should be able to log event origin (log action)', () => {
    const logs: any[] = [];
    const logAction = log(({ event, _event }) => ({
      event: event.type,
      origin: _event.origin
    }));

    const childMachine = createMachine({
      initial: 'bar',
      states: {
        bar: {}
      },
      on: {
        PING: {
          actions: [respond({ type: 'PONG' })]
        }
      }
    });

    const parentMachine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          invoke: {
            id: 'child',
            src: childMachine
          }
        }
      },
      on: {
        PING_CHILD: {
          actions: [sendTo('child', { type: 'PING' }), logAction]
        },
        '*': {
          actions: [logAction]
        }
      }
    });

    const service = interpret(parentMachine, {
      logger: (msg) => logs.push(msg)
    }).start();

    service.send({ type: 'PING_CHILD' });
    service.send({ type: 'PING_CHILD' });

    expect(logs.length).toBe(4);
    expect(logs).toMatchInlineSnapshot(`
      [
        {
          "event": "PING_CHILD",
          "origin": undefined,
        },
        {
          "event": "PONG",
          "origin": {
            "id": "child",
          },
        },
        {
          "event": "PING_CHILD",
          "origin": undefined,
        },
        {
          "event": "PONG",
          "origin": {
            "id": "child",
          },
        },
      ]
    `);
  });

  it('should receive correct _event (log action)', () => {
    const logs: any[] = [];
    const logAction = log(({ _event }) => _event.data.type);

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

    const service = interpret(parentMachine, {
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
    const machine = createMachine<Ctx, Events>({
      id: 'sendexpr',
      initial: 'start',
      context: {
        password: 'foo'
      },
      states: {
        start: {
          entry: raise(({ context }) => ({
            type: 'NEXT',
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
      interpret(machine)
        .onDone(() => done())
        .start();
    });
  });

  describe('sendParent() event expressions', () => {
    it('should resolve sendParent event expressions', (done) => {
      const childMachine = createMachine({
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

      const parentMachine = createMachine<
        any,
        { type: 'NEXT'; password: string }
      >({
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

      const actor = interpret(parentMachine);
      actor.subscribe((state) => {
        if (state.matches('start')) {
          const childActor = state.children.child;

          expect(typeof childActor!.send).toBe('function');
        }
      });
      actor.onDone(() => done()).start();
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
      const service = interpret(sendMachine)
        .onDone(() => done())
        .start();

      service.send({ type: 'ACTIVATE' });
    });

    it('can send events with an object', (done) => {
      const service = interpret(sendMachine)
        .onDone(() => done())
        .start();

      service.send({ type: 'ACTIVATE' });
    });

    it('can send events with an object with payload', (done) => {
      const service = interpret(sendMachine)
        .onDone(() => done())
        .start();

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

      const toggleService = interpret(toggleMachine)
        .onDone(() => {
          done();
        })
        .start();

      toggleService.send({ type: 'ACTIVATE' });
      toggleService.send({ type: 'INACTIVATE' });
    });
  });

  describe('.start()', () => {
    const startMachine = createMachine({
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

    it('should initialize the service', (done) => {
      let state: any;
      const startService = interpret(startMachine);
      startService.subscribe((s) => {
        state = s;
        expect(s).toBeDefined();
        expect(s.value).toEqual(startMachine.initialState.value);
        done();
      });

      expect(state).not.toBeDefined();

      startService.start();
    });

    it('should not reinitialize a started service', () => {
      let stateCount = 0;
      const startService = interpret(startMachine);

      startService.subscribe(() => {
        stateCount++;
      });

      startService.start();
      expect(stateCount).toEqual(1);

      startService.start();
      expect(stateCount).toEqual(1);
    });

    it('should be able to be initialized at a custom state', (done) => {
      const startService = interpret(startMachine, {
        state: State.from('bar', undefined, startMachine)
      });

      startService.subscribe((state) => {
        expect(state.matches('bar')).toBeTruthy();
        done();
      });

      startService.start();
    });

    it('should be able to be initialized at a custom state value', (done) => {
      const barState = startMachine.resolveStateValue('bar');
      const startService = interpret(startMachine, {
        state: barState
      });

      startService.subscribe((state) => {
        expect(state.matches('bar')).toBeTruthy();
        done();
      });

      startService.start();
    });

    it('should be able to resolve a custom initialized state', (done) => {
      const startService = interpret(startMachine, {
        state: startMachine.resolveStateValue('foo')
      });
      startService.subscribe((state) => {
        expect(state.matches({ foo: 'one' })).toBeTruthy();
        done();
      });

      startService.start();
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

      const delayedService = interpret(delayedMachine).start();

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

      const service = interpret(testMachine).start();

      service.stop();

      service.send({ type: 'TRIGGER' });

      setTimeout(() => {
        expect(called).toBeFalsy();
        done();
      }, 10);
    });

    it('stopping a not-started interpreter should not crash', () => {
      const service = interpret(
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

      const toggleService = interpret(toggleMachine).start();

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
      const service = interpret(stateMachine);
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
      const service = interpret(stateMachine);
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
    const intervalMachine = createMachine<typeof context>({
      id: 'interval',
      context,
      initial: 'active',
      states: {
        active: {
          after: {
            10: {
              target: 'active',
              actions: assign({ count: ({ context }) => context.count + 1 })
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
      const intervalService = interpret(intervalMachine).start();

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
      const intervalService = interpret(intervalMachine).start();

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
      const machine = createMachine<typeof countContext>({
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
      const service = interpret(machine)
        .onDone(() => {
          expect(count).toEqual(2);
          done();
        })
        .start();

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

      const service = interpret(
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

      const service = interpret(createMachine({})).start();

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
      const machine = createMachine(
        {
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
            testService: fromCallback(() => {
              // nothing
            })
          }
        }
      );

      const service = interpret(machine);
      expect(() => service.start()).not.toThrow();
    });
  });

  describe('children', () => {
    it('state.children should reference invoked child actors (machine)', (done) => {
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

      const service = interpret(parentMachine).onDone(() => {
        expect(service.getSnapshot().children).not.toHaveProperty('childActor');
        done();
      });

      service.subscribe((state) => {
        const childActor = state.children.childActor;

        if (state.matches('active') && childActor) {
          childActor.send({ type: 'FIRE' });
        }
      });

      service.start();
    });

    it('state.children should reference invoked child actors (promise)', (done) => {
      const parentMachine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'childActor',
              src: fromPromise(
                () =>
                  new Promise((res) => {
                    setTimeout(() => {
                      res(42);
                    }, 100);
                  })
              ),
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
      });

      const service = interpret(parentMachine).onDone(() => {
        expect(service.getSnapshot().matches('success')).toBeTruthy();
        expect(service.getSnapshot().children).not.toHaveProperty('childActor');
        done();
      });

      service.subscribe((state) => {
        if (state.matches('active')) {
          const childActor = state.children.childActor;

          expect(childActor).toHaveProperty('send');
        }
      });

      service.start();
    });

    it('state.children should reference invoked child actors (observable)', (done) => {
      const interval$ = interval(10);

      const parentMachine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'childActor',
              src: fromObservable(() => interval$),
              onSnapshot: {
                target: 'success',
                guard: ({ event }) => {
                  return event.data === 3;
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const service = interpret(parentMachine).onDone(() => {
        expect(service.getSnapshot().children).not.toHaveProperty('childActor');
        done();
      });

      service.subscribe((state) => {
        if (state.matches('active')) {
          expect(state.children['childActor']).not.toBeUndefined();
        }
      });

      service.start();
    });

    it('state.children should reference spawned actors', (done) => {
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

      const actor = interpret(formMachine);
      actor.subscribe((state) => {
        expect(state.children).toHaveProperty('child');
        done();
      });
      actor.start();
    });

    it('stopped spawned actors should be cleaned up in parent', (done) => {
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
          promiseRef: ActorRefFrom<Promise<unknown>>;
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

      const service = interpret(parentMachine)
        .onDone(() => {
          expect(service.getSnapshot().children.machineChild).toBeUndefined();
          expect(service.getSnapshot().children.promiseChild).toBeUndefined();
          expect(
            service.getSnapshot().children.observableChild
          ).toBeUndefined();
          done();
        })
        .start();

      service.subscribe((state) => {
        if (state.matches('present')) {
          expect(state.children).toHaveProperty('machineChild');
          expect(state.children).toHaveProperty('promiseChild');
          expect(state.children).toHaveProperty('observableChild');

          service.send({ type: 'NEXT' });
        }
      });
    });
  });

  it("shouldn't execute actions when reading a snapshot of not started actor", () => {
    const spy = jest.fn();
    const actorRef = interpret(
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

    const actorRef = interpret(
      createMachine({
        entry: spy
      })
    );

    actorRef.getSnapshot();
    expect(spy).not.toHaveBeenCalled();

    actorRef.start();

    expect(spy).toHaveBeenCalled();
  });

  it('the first state of an actor should be its initial state', (done) => {
    const machine = createMachine({});

    const actor = interpret(machine);

    const initialState = actor.getSnapshot();

    actor.subscribe((state) => {
      expect(state).toBe(initialState);
      done();
    });
    actor.start();
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

    const service = interpret(machine).start();

    expect(service.status).toBe(InterpreterStatus.Stopped);

    service.onDone(() => {
      done();
    });
  });
});
