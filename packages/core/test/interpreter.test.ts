import { interpret, Interpreter, spawn } from '../src/interpreter';
import { SimulatedClock } from '../src/SimulatedClock';
import { machine as idMachine } from './fixtures/id';
import {
  Machine,
  actions,
  assign,
  send,
  sendParent,
  StateValue,
  AnyEventObject,
  createMachine,
  AnyState,
  InterpreterStatus,
  ActorRefFrom,
  ActorRef
} from '../src';
import { State } from '../src/State';
import { log, actionTypes, raise, stop, sendTo } from '../src/actions';
import { isObservable } from '../src/utils';
import { interval, from } from 'rxjs';
import { map } from 'rxjs/operators';

const lightMachine = Machine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      onEntry: [actions.send('TIMER', { delay: 10 })],
      on: {
        TIMER: 'yellow',
        KEEP_GOING: {
          target: 'green',
          actions: [actions.cancel('TIMER')],
          internal: true
        }
      }
    },
    yellow: {
      onEntry: [actions.send('TIMER', { delay: 10 })],
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
  it('creates an interpreter', () => {
    const service = interpret(idMachine);

    expect(service).toBeInstanceOf(Interpreter);
  });

  describe('initial state', () => {
    it('immediately notifies the listener with the initial state and event', (done) => {
      const service = interpret(idMachine).onTransition(
        (initialState, event) => {
          expect(initialState).toBeInstanceOf(State);
          expect(initialState.value).toEqual(idMachine.initialState.value);
          expect(event.type).toEqual(actionTypes.init);
          done();
        }
      );

      service.start();
    });

    it('.initialState returns the initial state', () => {
      const service = interpret(idMachine);

      expect(service.initialState.value).toEqual(idMachine.initialState.value);
    });

    it('initial state should be cached', (done) => {
      let entryCalled = 0;
      let promiseSpawned = 0;

      const machine = createMachine<any, any, any>({
        initial: 'idle',
        context: {
          actor: undefined
        },
        states: {
          idle: {
            entry: assign({
              actor: () => {
                entryCalled++;
                return spawn(
                  new Promise(() => {
                    promiseSpawned++;
                  })
                );
              }
            })
          }
        }
      });

      const service = interpret(machine);

      expect(entryCalled).toEqual(0);
      expect(promiseSpawned).toEqual(0);

      const callInitialState = () => service.initialState;
      callInitialState();
      callInitialState();
      callInitialState();

      service.start();

      expect(entryCalled).toEqual(1);

      setTimeout(() => {
        expect(promiseSpawned).toEqual(1);
        done();
      }, 100);
    });

    // https://github.com/statelyai/xstate/issues/1174
    it('executes actions from a restored state', (done) => {
      const lightMachine = Machine(
        {
          id: 'light',
          initial: 'green',
          states: {
            green: {
              on: {
                TIMER: {
                  target: 'yellow',
                  actions: 'report'
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
        },
        {
          actions: {
            report: () => {
              done();
            }
          }
        }
      );

      const currentState = 'green';
      const nextState = lightMachine.transition(currentState, 'TIMER');

      // saves state and recreate it
      const recreated = JSON.parse(JSON.stringify(nextState));
      const previousState = State.create(recreated);

      const service = interpret(lightMachine);
      service.start(previousState);
    });
  });

  describe('subscribing', () => {
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {}
      }
    });

    it('should notify subscribers of the current state upon subscription (subscribe)', (done) => {
      const service = interpret(machine).start();

      service.subscribe((state) => {
        expect(state.value).toBe('active');
        done();
      });
    });

    it('should notify subscribers of the current state upon subscription (onTransition)', (done) => {
      const service = interpret(machine).start();

      service.onTransition((state) => {
        expect(state.value).toBe('active');
        done();
      });
    });
  });

  describe('.nextState() method', () => {
    it('returns the next state for the given event without changing the interpreter state', () => {
      let state: any;

      const service = interpret(lightMachine, {
        clock: new SimulatedClock()
      })
        .onTransition((s) => {
          state = s;
        })
        .start();

      const nextState = service.nextState('TIMER');
      expect(nextState.value).toEqual('yellow');
      expect(state.value).toEqual('green');
    });
  });

  describe('send with delay', () => {
    it('can send an event after a delay', () => {
      const currentStates: Array<AnyState> = [];

      const service = interpret(lightMachine, {
        clock: new SimulatedClock()
      }).onTransition((state) => {
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

      const delayExprMachine = Machine<
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
            onEntry: send('FINISH', {
              delay: (ctx, e) =>
                ctx.initialDelay +
                ('wait' in e
                  ? (e as Extract<DelayExpMachineEvents, { type: 'ACTIVATE' }>)
                      .wait
                  : 0)
            }),
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

      const delayExprMachine = Machine<
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
            onEntry: send('FINISH', {
              delay: (ctx, _, { _event }) =>
                ctx.initialDelay +
                (
                  _event.data as Extract<
                    DelayExpMachineEvents,
                    { type: 'ACTIVATE' }
                  >
                ).wait
            }),
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
      const letterMachine = Machine(
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
                  delay: (ctx) => ctx.delay,
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
              onEntry: send({ type: 'FIRE_DELAY', value: 200 }, { delay: 20 }),
              on: {
                FIRE_DELAY: 'd'
              }
            },
            d: {
              after: [
                {
                  delay: (ctx, e) => ctx.delay + (e as any).value,
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
            someDelay: (ctx) => {
              return ctx.delay + 50;
            }
          }
        }
      );

      let state: any;

      interpret(letterMachine, { clock })
        .onTransition((s) => {
          state = s;
        })
        .onDone(() => {
          done();
        })
        .start();

      expect(state.value).toEqual('a');
      clock.increment(100);
      expect(state.value).toEqual('b');
      clock.increment(100 + 50);
      expect(state.value).toEqual('c');
      clock.increment(20);
      expect(state.value).toEqual('d');
      clock.increment(100 + 200);
      expect(state.value).toEqual('e');
      clock.increment(100 + 50);
    });
  });

  describe('activities (deprecated)', () => {
    let activityState = 'off';

    const activityMachine = Machine(
      {
        id: 'activity',
        initial: 'on',
        states: {
          on: {
            activities: 'myActivity',
            on: {
              TURN_OFF: 'off'
            }
          },
          off: {}
        }
      },
      {
        activities: {
          myActivity: () => {
            activityState = 'on';
            return () => (activityState = 'off');
          }
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

      service.send('TURN_OFF');

      expect(activityState).toEqual('off');
    });

    it('should stop activities upon stopping the service', () => {
      let stopActivityState: string;

      const stopActivityMachine = Machine(
        {
          id: 'stopActivity',
          initial: 'on',
          states: {
            on: {
              activities: 'myActivity',
              on: {
                TURN_OFF: 'off'
              }
            },
            off: {}
          }
        },
        {
          activities: {
            myActivity: () => {
              stopActivityState = 'on';
              return () => (stopActivityState = 'off');
            }
          }
        }
      );

      const stopActivityService = interpret(stopActivityMachine).start();

      expect(stopActivityState!).toEqual('on');

      stopActivityService.stop();

      expect(stopActivityState!).toEqual('off');
    });

    it('should not restart activities from a compound state', () => {
      let activityActive = false;

      const toggleMachine = Machine(
        {
          id: 'toggle',
          initial: 'inactive',
          states: {
            inactive: {
              on: { TOGGLE: 'active' }
            },
            active: {
              activities: 'blink',
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
          activities: {
            blink: () => {
              activityActive = true;

              return () => {
                activityActive = false;
              };
            }
          }
        }
      );

      const activeState = toggleMachine.transition(
        toggleMachine.initialState,
        'TOGGLE'
      );
      const bState = toggleMachine.transition(activeState, 'SWITCH');
      let state: any;
      interpret(toggleMachine)
        .onTransition((s) => {
          state = s;
        })
        .start(bState);

      expect(state.activities.blink).toBeTruthy();
      expect(activityActive).toBe(false);
    });
  });

  it('can cancel a delayed event', () => {
    let currentState: AnyState;

    const service = interpret(lightMachine, {
      clock: new SimulatedClock()
    }).onTransition((state) => (currentState = state));
    const clock = service.clock as SimulatedClock;
    service.start();

    clock.increment(5);
    service.send('KEEP_GOING');

    expect(currentState!.value).toEqual('green');
    clock.increment(10);
    expect(currentState!.value).toEqual('green');
  });

  it('should throw an error if an event is sent to an uninitialized interpreter if { deferEvents: false }', () => {
    const service = interpret(lightMachine, {
      clock: new SimulatedClock(),
      deferEvents: false
    });

    expect(() => service.send('SOME_EVENT'))
      .toThrowErrorMatchingInlineSnapshot(`
"Event \\"SOME_EVENT\\" was sent to uninitialized service \\"light\\". Make sure .start() is called for this service, or set { deferEvents: true } in the service options.
Event: {\\"type\\":\\"SOME_EVENT\\"}"
`);

    service.start();

    expect(() => service.send('SOME_EVENT')).not.toThrow();
  });

  it('should not throw an error if an event is sent to an uninitialized interpreter if { deferEvents: true }', () => {
    const service = interpret(lightMachine, {
      clock: new SimulatedClock(),
      deferEvents: true
    });

    expect(() => service.send('SOME_EVENT')).not.toThrow();

    service.start();

    expect(() => service.send('SOME_EVENT')).not.toThrow();
  });

  it('should not throw an error if an event is sent to an uninitialized interpreter (default options)', () => {
    const service = interpret(lightMachine, {
      clock: new SimulatedClock()
    });

    expect(() => service.send('SOME_EVENT')).not.toThrow();

    service.start();

    expect(() => service.send('SOME_EVENT')).not.toThrow();
  });

  it('should defer events sent to an uninitialized service', (done) => {
    const deferMachine = Machine({
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
    const deferService = interpret(deferMachine)
      .onTransition((s) => {
        state = s;
      })
      .onDone(() => done());

    // uninitialized
    deferService.send('NEXT_A');
    deferService.send('NEXT_B');

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
      interpret(Machine(invalidMachine)).start();
    }).toThrowErrorMatchingInlineSnapshot(
      `"Initial state 'create' not found on 'fetchMachine'"`
    );
  });

  it('should not update when stopped', () => {
    let state = lightMachine.initialState;
    const service = interpret(lightMachine, {
      clock: new SimulatedClock()
    }).onTransition((s) => (state = s));

    service.start();
    service.send('TIMER'); // yellow
    expect(state.value).toEqual('yellow');

    service.stop();
    try {
      service.send('TIMER'); // red if interpreter is not stopped
    } catch (e) {
      expect(state.value).toEqual('yellow');
    }
  });

  it('should be able to log (log action)', () => {
    const logs: any[] = [];

    const logMachine = Machine<{ count: number }>({
      id: 'log',
      initial: 'x',
      context: { count: 0 },
      states: {
        x: {
          on: {
            LOG: {
              actions: [
                assign({ count: (ctx) => ctx.count + 1 }),
                log((ctx) => ctx)
              ]
            }
          }
        }
      }
    });

    const service = interpret(logMachine, {
      logger: (msg) => logs.push(msg)
    }).start();

    service.send('LOG');
    service.send('LOG');

    expect(logs.length).toBe(2);
    expect(logs).toEqual([{ count: 1 }, { count: 2 }]);
  });

  it('should be able to log event origin (log action)', () => {
    const logs: any[] = [];
    const logAction = log((_ctx, event, meta) => ({
      event: event.type,
      origin: meta._event.origin
    }));

    const childMachine = Machine({
      initial: 'bar',
      states: {
        bar: {}
      },
      on: {
        PING: {
          actions: [actions.respond('PONG')]
        }
      }
    });

    const parentMachine = Machine({
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
          actions: [sendTo('child', 'PING'), logAction]
        },
        '*': {
          actions: [logAction]
        }
      }
    });

    const service = interpret(parentMachine, {
      logger: (msg) => logs.push(msg)
    }).start();

    service.send('PING_CHILD');
    service.send('PING_CHILD');

    expect(logs.length).toBe(4);
    expect(logs).toEqual([
      { event: 'PING_CHILD', origin: undefined },
      { event: 'PONG', origin: expect.stringMatching(/.+/) },
      { event: 'PING_CHILD', origin: undefined },
      { event: 'PONG', origin: expect.stringMatching(/.+/) }
    ]);
  });

  it('should receive correct _event (log action)', () => {
    const logs: any[] = [];
    const logAction = log((_ctx, _ev, meta) => meta._event.data.type);

    const parentMachine = Machine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            EXTERNAL_EVENT: {
              actions: [raise('RAISED_EVENT'), logAction]
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

    service.send('EXTERNAL_EVENT');

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
    const machine = Machine<Ctx, Events>({
      id: 'sendexpr',
      initial: 'start',
      context: {
        password: 'foo'
      },
      states: {
        start: {
          entry: send((ctx) => ({ type: 'NEXT', password: ctx.password })),
          on: {
            NEXT: {
              target: 'finish',
              cond: (_, e) => e.password === 'foo'
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

    it('should be able to raise event using special target', () => {
      const raiseMachine = Machine({
        initial: 'foo',
        states: {
          foo: {
            entry: [send('EVENT_2'), send('EVENT_1', { to: '#_internal' })],
            on: {
              EVENT_1: 'pass',
              EVENT_2: 'fail'
            }
          },
          pass: {
            type: 'final'
          },
          fail: {
            type: 'final'
          }
        }
      });

      let state: AnyState;

      interpret(raiseMachine)
        .onTransition((s) => {
          state = s;
        })
        .onDone(() => {
          expect(state.value).toBe('pass');
        })
        .start();
    });
  });

  describe('sendParent() event expressions', () => {
    interface Ctx {
      password: string;
    }
    interface Events {
      type: 'NEXT';
      password: string;
    }
    const childMachine = Machine<Ctx>({
      id: 'child',
      initial: 'start',
      context: {
        password: 'unknown'
      },
      states: {
        start: {
          onEntry: sendParent((ctx) => ({
            type: 'NEXT',
            password: ctx.password
          }))
        }
      }
    });
    // Ctx, any, Events, any
    const parentMachine = createMachine<Ctx, Events>({
      id: 'parent',
      initial: 'start',
      states: {
        start: {
          invoke: {
            id: 'child',
            src: childMachine,
            data: {
              password: 'foo'
            }
          },
          on: {
            NEXT: {
              target: 'finish',
              cond: (_, e) => e.password === 'foo'
            }
          }
        },
        finish: {
          type: 'final'
        }
      }
    });

    it('should resolve sendParent event expressions', (done) => {
      interpret(parentMachine)
        .onTransition((state) => {
          if (state.matches('start')) {
            expect(state.children).toHaveProperty('child');
            expect(typeof state.children.child.send).toBe('function');
          }
        })
        .onDone(() => done())
        .start();
    });
  });

  describe('send() batch events', () => {
    const countMachine = Machine<{ count: number }>({
      id: 'count',
      initial: 'even',
      context: { count: 0 },
      states: {
        even: {
          exit: [assign({ count: (ctx) => ctx.count + 1 }), 'evenAction'],
          on: { INC: 'odd' }
        },
        odd: {
          exit: [assign({ count: (ctx) => ctx.count + 1 }), 'oddAction'],
          on: { INC: 'even' }
        }
      }
    });

    const countMachineNoActions = Machine<{ count: number }>({
      id: 'count',
      initial: 'even',
      context: { count: 0 },
      states: {
        even: {
          on: { ODD: 'odd' }
        },
        odd: {
          on: { EVEN: 'even' }
        }
      }
    });

    it('should batch send events', (done) => {
      let transitions = 0;
      const evenCounts: number[] = [];
      const oddCounts: number[] = [];
      const countService = interpret(
        countMachine.withConfig({
          actions: {
            evenAction: (ctx) => {
              evenCounts.push(ctx.count);
            },
            oddAction: (ctx) => {
              oddCounts.push(ctx.count);
            }
          }
        })
      )
        .onTransition((state) => {
          transitions++;

          switch (transitions) {
            // initial state
            case 1:
              expect(state.context).toEqual({ count: 0 });
              break;
            // transition with batched events
            case 2:
              expect(state.value).toEqual('even');
              expect(state.context).toEqual({ count: 4 });
              expect(state.actions.map((a) => a.type)).toEqual([
                'evenAction',
                'oddAction',
                'evenAction',
                'oddAction'
              ]);

              expect(evenCounts).toEqual([1, 3]);
              expect(oddCounts).toEqual([2, 4]);
              done();
              break;
          }
        })
        .start();

      countService.send(['INC', 'INC', { type: 'INC' }, 'INC']);
    });

    it('state changed property should be true if any intermediate state is changed', (done) => {
      let transitions = 0;

      const countService = interpret(countMachine)
        .onTransition((state) => {
          transitions++;

          if (transitions === 2) {
            expect(state.changed).toBe(true);
            done();
          }
        })
        .start();

      countService.send(['INC', 'bar']);
    });

    it('state changed property should be false if no intermediate state is changed', (done) => {
      let transitions = 0;

      const countService = interpret(countMachine)
        .onTransition((state) => {
          transitions++;
          if (transitions === 2) {
            expect(state.changed).toBe(false);
            done();
          }
        })
        .start();

      countService.send(['foo', 'bar']);
    });

    it('state changed property should be true if a subsequent send call changes the state', (done) => {
      let transitions = 0;

      const countService = interpret(countMachineNoActions)
        .onTransition((state) => {
          transitions++;
          if (transitions === 3) {
            expect(state.changed).toBe(true);
            done();
          }
        })
        .start();

      countService.send(['ODD']);
      countService.send(['EVEN']);
    });

    it('state changed property should be false if a subsequent send call did not actually change the state', (done) => {
      let transitions = 0;

      const countService = interpret(countMachineNoActions)
        .onTransition((state) => {
          transitions++;
          if (transitions === 3) {
            expect(state.changed).toBe(false);
            done();
          }
        })
        .start();

      countService.send(['ODD']);
      countService.send(['ODD']);
    });
  });

  describe('send()', () => {
    const sendMachine = createMachine({
      id: 'send',
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            EVENT: {
              target: 'active',
              cond: (_: any, e: any) => e.id === 42 // TODO: fix unknown event type
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

      service.send('ACTIVATE');
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

    it('can send events with a string and object payload', (done) => {
      let state: any;
      const service = interpret(sendMachine)
        .onTransition((s) => {
          state = s;
        })
        .onDone(() => {
          expect(state.event).toEqual({ type: 'EVENT', id: 42 });
          done();
        })
        .start();

      service.send('EVENT', { id: 42 });
    });

    it('should receive and process all events sent simultaneously', (done) => {
      const toggleMachine = Machine({
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

      toggleService.send('ACTIVATE');
      toggleService.send('INACTIVATE');
    });
  });

  describe('start()', () => {
    const startMachine = Machine({
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
      const startService = interpret(startMachine).onTransition((s) => {
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
      const startService = interpret(startMachine).onTransition(() => {
        stateCount++;
      });

      startService.start();
      expect(stateCount).toEqual(1);

      startService.start();
      expect(stateCount).toEqual(1);
    });

    it('should be able to be initialized at a custom state', (done) => {
      const startService = interpret(startMachine).onTransition((state) => {
        expect(state.matches('bar')).toBeTruthy();
        done();
      });

      startService.start(State.from('bar'));
    });

    it('should be able to be initialized at a custom state value', (done) => {
      const startService = interpret(startMachine).onTransition((state) => {
        expect(state.matches('bar')).toBeTruthy();
        done();
      });

      startService.start('bar');
    });

    it('should be able to resolve a custom initialized state', (done) => {
      const startService = interpret(startMachine).onTransition((state) => {
        expect(state.matches({ foo: 'one' })).toBeTruthy();
        done();
      });

      startService.start(State.from('foo'));
    });
  });

  describe('stop()', () => {
    it('should cancel delayed events', (done) => {
      let called = false;
      const delayedMachine = Machine({
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

      const testMachine = Machine({
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

      service.send('TRIGGER');

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

  describe('off()', () => {
    it('should remove transition listeners', () => {
      const toggleMachine = Machine({
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

      toggleService.onTransition(listener);

      expect(stateCount).toEqual(1);

      toggleService.send('TOGGLE');

      expect(stateCount).toEqual(2);

      toggleService.send('TOGGLE');

      expect(stateCount).toEqual(3);

      toggleService.off(listener);
      toggleService.send('TOGGLE');

      expect(stateCount).toEqual(3);
    });
  });

  describe('options', () => {
    describe('execute', () => {
      it('should not execute actions if execute is false', (done) => {
        let effect = false;

        const machine = Machine({
          id: 'noExecute',
          initial: 'active',
          states: {
            active: {
              type: 'final',
              onEntry: () => {
                effect = true;
              }
            }
          }
        });

        interpret(machine, { execute: false })
          .onDone(() => {
            expect(effect).toBe(false);
            done();
          })
          .start();
      });

      it('should not execute actions if execute is true (default)', (done) => {
        let effect = false;

        const machine = Machine({
          id: 'noExecute',
          initial: 'active',
          states: {
            active: {
              type: 'final',
              onEntry: () => {
                effect = true;
              }
            }
          }
        });

        interpret(machine, { execute: true })
          .onDone(() => {
            expect(effect).toBe(true);
            done();
          })
          .start();
      });

      it('actions should be able to be executed manually with execute()', (done) => {
        let effect = false;

        const machine = Machine({
          id: 'noExecute',
          initial: 'active',
          context: {
            value: true
          },
          states: {
            active: {
              type: 'final',
              onEntry: (ctx) => {
                effect = ctx.value;
              }
            }
          }
        });

        const service = interpret(machine, { execute: false })
          .onTransition((state) => {
            setTimeout(() => {
              service.execute(state);
              expect(effect).toBe(true);
              done();
            }, 10);
          })
          .onDone(() => {
            expect(effect).toBe(false);
          })
          .start();
      });

      it('actions should be configurable with execute()', (done) => {
        let effect = false;

        const machine = Machine({
          id: 'noExecute',
          initial: 'active',
          context: {
            value: true
          },
          states: {
            active: {
              type: 'final',
              onEntry: 'doEffect'
            }
          }
        });

        const service = interpret(machine, { execute: false })
          .onTransition((state) => {
            setTimeout(() => {
              service.execute(state, {
                doEffect: (ctx) => {
                  effect = ctx.value;
                }
              });
              expect(effect).toBe(true);
              done();
            }, 10);
          })
          .onDone(() => {
            expect(effect).toBe(false);
          })
          .start();
      });
    });

    describe('id', () => {
      it('uses the ID specified in the options', () => {
        const service = interpret(lightMachine, { id: 'custom-id' });

        expect(service.id).toEqual('custom-id');
      });

      it('uses the machine ID if not specified', () => {
        const service = interpret(lightMachine);

        expect(service.id).toEqual(lightMachine.id);
      });
    });

    describe('devTools', () => {
      it('devTools should not be connected by default', () => {
        const service = interpret(lightMachine);

        expect(service.options.devTools).toBe(false);
      });
    });
  });

  describe('transient states', () => {
    it('should transition in correct order', () => {
      const stateMachine = Machine({
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
      const service = interpret(stateMachine)
        .onTransition((current) => stateValues.push(current.value))
        .start();
      service.send('START');

      const expectedStateValues = ['idle', 'next'];
      expect(stateValues.length).toEqual(expectedStateValues.length);
      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });

    it('should transition in correct order when there is a condition', () => {
      const stateMachine = Machine(
        {
          id: 'transient',
          initial: 'idle',
          states: {
            idle: { on: { START: 'transient' } },
            transient: {
              always: [
                { target: 'end', cond: 'alwaysFalse' },
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
      const service = interpret(stateMachine)
        .onTransition((current) => stateValues.push(current.value))
        .start();
      service.send('START');

      const expectedStateValues = ['idle', 'next'];
      expect(stateValues.length).toEqual(expectedStateValues.length);
      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });
  });

  describe('observable', () => {
    const context = { count: 0 };
    const intervalMachine = Machine<typeof context>({
      id: 'interval',
      context,
      initial: 'active',
      states: {
        active: {
          after: {
            10: {
              target: 'active',
              actions: assign({ count: (ctx) => ctx.count + 1 })
            }
          },
          always: {
            target: 'finished',
            cond: (ctx) => ctx.count >= 5
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

        state$.subscribe(
          () => {
            count += 1;
          },
          undefined,
          () => {
            expect(count).toEqual(6);
            done();
          }
        );
      }).not.toThrow();
    });

    it('should be unsubscribable', (done) => {
      const countContext = { count: 0 };
      const machine = Machine<typeof countContext>({
        context: countContext,
        initial: 'active',
        states: {
          active: {
            always: {
              target: 'finished',
              cond: (ctx) => ctx.count >= 5
            },
            on: {
              INC: {
                actions: assign({ count: (ctx) => ctx.count + 1 })
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

      service.send('INC');
      service.send('INC');
      subscription.unsubscribe();
      service.send('INC');
      service.send('INC');
      service.send('INC');
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
        complete: completeCb
      });

      service.stop();

      expect(completeCb).toHaveBeenCalledTimes(1);
    });
  });

  describe('services', () => {
    it("doesn't crash cryptically on undefined return from the service creator", () => {
      const machine = Machine(
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
          services: {
            testService: (() => {
              return void 0;
            }) as any
          }
        }
      );

      const service = interpret(machine);
      expect(() => service.start()).not.toThrow();
    });
  });

  describe('children', () => {
    it('state.children should reference invoked child actors (machine)', (done) => {
      const childMachine = Machine({
        initial: 'active',
        states: {
          active: {
            on: {
              FIRE: {
                actions: sendParent('FIRED')
              }
            }
          }
        }
      });

      const parentMachine = Machine({
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

      const service = interpret(parentMachine)
        .onTransition((state) => {
          if (state.matches('active') && state.children.childActor) {
            state.children.childActor.send({ type: 'FIRE' });
          }
        })
        .onDone(() => {
          expect(service.state.children).not.toHaveProperty('childActor');
          done();
        });

      service.start();
    });

    it('state.children should reference invoked child actors (promise)', (done) => {
      const parentMachine = Machine({
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'childActor',
              src: () =>
                new Promise((res) => {
                  setTimeout(() => {
                    res(42);
                  }, 100);
                }),
              onDone: {
                target: 'success',
                cond: (_, e) => e.data === 42
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      let subscribed = false;

      const service = interpret(parentMachine)
        .onTransition((state) => {
          if (state.children.childActor && !subscribed) {
            subscribed = true;
            state.children.childActor.subscribe((data) => {
              expect(data).toEqual(42);
              done();
            });
          }
        })
        .onDone(() => {
          expect(service.state.children).not.toHaveProperty('childActor');
        });

      service.start();
    });

    it('state.children should reference invoked child actors (observable)', (done) => {
      const interval$ = interval(10);

      const parentMachine = Machine({
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'childActor',
              src: () =>
                interval$.pipe(map((value) => ({ type: 'FIRED', value })))
            },
            on: {
              FIRED: {
                target: 'success',
                cond: (_: unknown, e: AnyEventObject) => {
                  return e.value === 3;
                }
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      let subscribed = false;

      const service = interpret(parentMachine)
        .onTransition((state) => {
          if (
            state.matches('active') &&
            state.children.childActor &&
            !subscribed
          ) {
            subscribed = true;
            state.children.childActor.subscribe((data) => {
              if (data.value === 3) {
                done();
              }
            });
          }
        })
        .onDone(() => {
          expect(service.state.children).not.toHaveProperty('childActor');
        });

      service.start();
    });

    it('state.children should reference spawned actors', (done) => {
      const childMachine = Machine({
        initial: 'idle',
        states: {
          idle: {}
        }
      });

      const formMachine = createMachine<any, any, any>({
        id: 'form',
        initial: 'idle',
        context: {},
        entry: assign({
          firstNameRef: () => spawn(childMachine, 'child')
        }),
        states: {
          idle: {}
        }
      });

      interpret(formMachine)
        .onTransition((state) => {
          expect(state.children).toHaveProperty('child');
          done();
        })
        .start();
    });

    it('stopped spawned actors should be cleaned up in parent', (done) => {
      const childMachine = Machine({
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
          machineRef: () => spawn(childMachine, 'machineChild'),
          promiseRef: () =>
            spawn(
              new Promise(() => {
                // ...
              }),
              'promiseChild'
            ),
          observableRef: () => spawn(interval(1000), 'observableChild')
        }),
        states: {
          present: {
            on: {
              NEXT: {
                target: 'gone',
                actions: [
                  stop((ctx) => ctx.machineRef),
                  stop((ctx) => ctx.promiseRef),
                  stop((ctx) => ctx.observableRef)
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
          expect(service.children.get('machineChild')).toBeUndefined();
          expect(service.children.get('promiseChild')).toBeUndefined();
          expect(service.children.get('observableChild')).toBeUndefined();
          done();
        })
        .start();

      service.subscribe((state) => {
        if (state.matches('present')) {
          expect(state.children).toHaveProperty('machineChild');
          expect(state.children).toHaveProperty('promiseChild');
          expect(state.children).toHaveProperty('observableChild');

          service.send('NEXT');
        }
      });
    });
  });

  describe('.onDone(...)', () => {
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
});
