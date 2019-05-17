import { interpret, Interpreter } from '../src/interpreter';
import { SimulatedClock } from '../src/SimulatedClock';
import { assert } from 'chai';
import { machine as idMachine } from './fixtures/id';
import {
  Machine,
  actions,
  assign,
  send,
  sendParent,
  EventObject,
  StateValue
} from '../src';
import { State } from '../src/State';
import { log, actionTypes } from '../src/actions';
import { isObservable } from '../src/utils';

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

    assert.instanceOf(service, Interpreter);
  });

  it('immediately notifies the listener with the initial state and event', done => {
    const service = interpret(idMachine).onTransition((initialState, event) => {
      assert.instanceOf(initialState, State);
      assert.deepEqual(initialState.value, idMachine.initialState.value);
      assert.deepEqual(event.type, actionTypes.init);
      done();
    });

    service.start();
  });

  it('.initialState returns the initial state', () => {
    const service = interpret(idMachine);

    assert.deepEqual(service.initialState.value, idMachine.initialState.value);
  });

  describe('.nextState() method', () => {
    it('returns the next state for the given event without changing the interpreter state', () => {
      let state: any;

      const service = interpret(lightMachine, {
        clock: new SimulatedClock()
      })
        .onTransition(s => {
          state = s;
        })
        .start();

      const nextState = service.nextState('TIMER');
      assert.equal(nextState.value, 'yellow');
      assert.equal(state.value, 'green');
    });
  });

  describe('send with delay', () => {
    it('can send an event after a delay', () => {
      const currentStates: Array<State<any>> = [];
      const listener = state => {
        currentStates.push(state);

        if (currentStates.length === 4) {
          assert.deepEqual(currentStates.map(s => s.value), [
            'green',
            'yellow',
            'red',
            'green'
          ]);
        }
      };

      const service = interpret(lightMachine, {
        clock: new SimulatedClock()
      }).onTransition(listener);
      const clock = service.clock as SimulatedClock;
      service.start();

      clock.increment(5);
      assert.equal(
        currentStates[0]!.value,
        'green',
        'State should still be green before delayed send'
      );

      clock.increment(5);
      assert.deepEqual(currentStates.map(s => s.value), ['green', 'yellow']);

      clock.increment(5);
      assert.deepEqual(currentStates.map(s => s.value), ['green', 'yellow']);

      clock.increment(5);
      assert.deepEqual(currentStates.map(s => s.value), [
        'green',
        'yellow',
        'red'
      ]);

      clock.increment(5);
      assert.deepEqual(currentStates.map(s => s.value), [
        'green',
        'yellow',
        'red'
      ]);

      clock.increment(5);
      assert.deepEqual(currentStates.map(s => s.value), [
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

      const delayExprMachine = Machine<DelayExprMachineCtx>({
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
              delay: (ctx, e) => ctx.initialDelay + ('wait' in e ? e.wait : 0)
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

      assert.isFalse(stopped);

      clock.increment(50);

      assert.isTrue(stopped);
    });

    it('can send an event after a delay (delayed transitions)', done => {
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
                  delay: ctx => ctx.delay,
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
              onEntry: send(
                { type: 'FIRE_DELAY', value: 200 },
                { delay: 20 }
              ) as EventObject,
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
            someDelay: ctx => {
              return ctx.delay + 50;
            }
          }
        }
      );

      let state: any;

      interpret(letterMachine, { clock })
        .onTransition(s => {
          state = s;
        })
        .onDone(() => {
          done();
        })
        .start();

      assert.equal(state.value, 'a');
      clock.increment(100);
      assert.equal(state.value, 'b');
      clock.increment(100 + 50);
      assert.equal(state.value, 'c');
      clock.increment(20);
      assert.equal(state.value, 'd');
      clock.increment(100 + 200);
      assert.equal(state.value, 'e');
      clock.increment(100 + 50);
    });
  });

  describe('activities', () => {
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

      assert.equal(activityState, 'on');
    });

    it('should stop activities', () => {
      const service = interpret(activityMachine);

      service.start();

      assert.equal(activityState, 'on');

      service.send('TURN_OFF');

      assert.equal(activityState, 'off');
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

      assert.equal(stopActivityState!, 'on');

      stopActivityService.stop();

      assert.equal(stopActivityState!, 'off', 'activity should be disposed');
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
        .onTransition(s => {
          state = s;
        })
        .start(bState);

      assert.ok(state.activities.blink);
      assert.isFalse(activityActive);
    });
  });

  it('can cancel a delayed event', () => {
    let currentState: State<any>;
    const listener = state => (currentState = state);

    const service = interpret(lightMachine, {
      clock: new SimulatedClock()
    }).onTransition(listener);
    const clock = service.clock as SimulatedClock;
    service.start();

    clock.increment(5);
    service.send('KEEP_GOING');

    assert.deepEqual(currentState!.value, 'green');
    clock.increment(10);
    assert.deepEqual(
      currentState!.value,
      'green',
      'should still be green due to canceled event'
    );
  });

  it('should throw an error if an event is sent to an uninitialized interpreter if { deferEvents: false }', () => {
    const service = interpret(lightMachine, {
      clock: new SimulatedClock(),
      deferEvents: false
    });

    assert.throws(() => service.send('SOME_EVENT'), /uninitialized/);

    service.start();

    assert.doesNotThrow(() => service.send('SOME_EVENT'));
  });

  it('should not throw an error if an event is sent to an uninitialized interpreter if { deferEvents: true }', () => {
    const service = interpret(lightMachine, {
      clock: new SimulatedClock(),
      deferEvents: true
    });

    assert.doesNotThrow(() => service.send('SOME_EVENT'));

    service.start();

    assert.doesNotThrow(() => service.send('SOME_EVENT'));
  });

  it('should not throw an error if an event is sent to an uninitialized interpreter (default options)', () => {
    const service = interpret(lightMachine, {
      clock: new SimulatedClock()
    });

    assert.doesNotThrow(() => service.send('SOME_EVENT'));

    service.start();

    assert.doesNotThrow(() => service.send('SOME_EVENT'));
  });

  it('should defer events sent to an uninitialized service', done => {
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
      .onTransition(s => {
        state = s;
      })
      .onDone(() => done());

    // uninitialized
    deferService.send('NEXT_A');
    deferService.send('NEXT_B');

    assert.isUndefined(state);

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
            }
          }
        }
      }
    };

    const service = interpret(Machine(invalidMachine));
    assert.throws(
      () => service.start(),
      `Initial state 'create' not found on 'fetchMachine'`
    );
  });

  it('should not update when stopped', () => {
    let state = lightMachine.initialState;
    const service = interpret(lightMachine, {
      clock: new SimulatedClock()
    }).onTransition(s => (state = s));

    service.start();
    service.send('TIMER'); // yellow
    assert.deepEqual(state.value, 'yellow');

    service.stop();
    try {
      service.send('TIMER'); // red if interpreter is not stopped
    } catch (e) {
      assert.deepEqual(state.value, 'yellow');
    }
  });

  it('should be able to log (log action)', () => {
    const logs: any[] = [];

    const logMachine = Machine({
      id: 'log',
      initial: 'x',
      context: { count: 0 },
      states: {
        x: {
          on: {
            LOG: {
              actions: [
                assign({ count: ctx => ctx.count + 1 }),
                log(ctx => ctx)
              ]
            }
          }
        }
      }
    });

    const service = interpret(logMachine, {
      logger: msg => logs.push(msg)
    }).start();

    service.send('LOG');
    service.send('LOG');

    assert.lengthOf(logs, 2);
    assert.deepEqual(logs, [{ count: 1 }, { count: 2 }]);
  });

  describe('send() event expressions', () => {
    interface Ctx {
      password: string;
    }
    const machine = Machine<Ctx>({
      id: 'sendexpr',
      initial: 'start',
      context: {
        password: 'foo'
      },
      states: {
        start: {
          onEntry: send(ctx => ({ type: 'NEXT', password: ctx.password })),
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

    it('should resolve send event expressions', done => {
      interpret(machine)
        .onDone(() => done())
        .start();
    });
  });

  describe('sendParent() event expressions', () => {
    interface Ctx {
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
          onEntry: sendParent(ctx => ({ type: 'NEXT', password: ctx.password }))
        }
      }
    });

    const parentMachine = Machine<Ctx>({
      id: 'parent',
      initial: 'start',
      states: {
        start: {
          invoke: {
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

    it('should resolve sendParent event expressions', done => {
      interpret(parentMachine)
        .onDone(() => done())
        .start();
    });
  });

  describe('send() batch events', () => {
    const countMachine = Machine({
      id: 'count',
      initial: 'even',
      context: { count: 0 },
      states: {
        even: {
          onExit: [assign({ count: ctx => ctx.count + 1 }), 'evenAction'],
          on: { INC: 'odd' }
        },
        odd: {
          onExit: [assign({ count: ctx => ctx.count + 1 }), 'oddAction'],
          on: { INC: 'even' }
        }
      }
    });

    it('should batch send events', done => {
      let transitions = 0;
      const evenCounts: number[] = [];
      const oddCounts: number[] = [];
      const countService = interpret(
        countMachine.withConfig({
          actions: {
            evenAction: ctx => {
              evenCounts.push(ctx.count);
            },
            oddAction: ctx => {
              oddCounts.push(ctx.count);
            }
          }
        })
      )
        .onTransition(state => {
          transitions++;

          switch (transitions) {
            // initial state
            case 1:
              assert.deepEqual(state.context, { count: 0 });
              break;
            // transition with batched events
            case 2:
              assert.equal(state.value, 'even');
              assert.deepEqual(state.context, { count: 4 });
              assert.deepEqual(state.actions.map(a => a.type), [
                'evenAction',
                'oddAction',
                'evenAction',
                'oddAction'
              ]);

              assert.deepEqual(
                evenCounts,
                [1, 3],
                'even actions should be bound to their state at time of creation'
              );
              assert.deepEqual(
                oddCounts,
                [2, 4],
                'odd actions should be bound to their state at time of creation'
              );
              done();
              break;
          }
        })
        .start();

      countService.send(['INC', 'INC', { type: 'INC' }, 'INC']);
    });

    it('state changed property should be true if any intermediate state is changed', done => {
      let transitions = 0;

      const countService = interpret(countMachine)
        .onTransition(state => {
          transitions++;

          if (transitions === 2) {
            assert.isTrue(state.changed);
            done();
          }
        })
        .start();

      countService.send(['INC', 'bar']);
    });

    it('state changed property should be false if no intermediate state is changed', done => {
      let transitions = 0;

      const countService = interpret(countMachine)
        .onTransition(state => {
          transitions++;

          if (transitions === 2) {
            assert.isFalse(state.changed);
            done();
          }
        })
        .start();

      countService.send(['foo', 'bar']);
    });
  });

  describe('send()', () => {
    const sendMachine = Machine({
      id: 'send',
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            EVENT: {
              target: 'active',
              cond: (_, e: any) => e.id === 42 // TODO: fix unknown event type
            },
            ACTIVATE: 'active'
          }
        },
        active: {
          type: 'final'
        }
      }
    });

    it('can send events with a string', done => {
      const service = interpret(sendMachine)
        .onDone(() => done())
        .start();

      service.send('ACTIVATE');
    });

    it('can send events with an object', done => {
      const service = interpret(sendMachine)
        .onDone(() => done())
        .start();

      service.send({ type: 'ACTIVATE' });
    });

    it('can send events with an object with payload', done => {
      const service = interpret(sendMachine)
        .onDone(() => done())
        .start();

      service.send({ type: 'EVENT', id: 42 });
    });

    it('can send events with a string and object payload', done => {
      let state: any;
      const service = interpret(sendMachine)
        .onTransition(s => {
          state = s;
        })
        .onDone(() => {
          assert.deepEqual(state.event, { type: 'EVENT', id: 42 });
          done();
        })
        .start();

      service.send('EVENT', { id: 42 });
    });

    it('should receive and process all events sent simultaneously', done => {
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

    it('should initialize the service', done => {
      let state: any;
      const startService = interpret(startMachine).onTransition(s => {
        state = s;
        assert.isDefined(s);
        assert.deepEqual(s.value, startMachine.initialState.value);
        done();
      });

      assert.isUndefined(state);

      startService.start();
    });

    it('should be able to be initialized at a custom state', done => {
      const startService = interpret(startMachine).onTransition(state => {
        assert.ok(state.matches('bar'));
        done();
      });

      startService.start(State.from('bar'));
    });

    it('should be able to be initialized at a custom state value', done => {
      const startService = interpret(startMachine).onTransition(state => {
        assert.ok(state.matches('bar'));
        done();
      });

      startService.start('bar');
    });

    it('should be able to resolve a custom initialized state', done => {
      const startService = interpret(startMachine).onTransition(state => {
        assert.ok(state.matches({ foo: 'one' }));
        done();
      });

      startService.start(State.from('foo'));
    });
  });

  describe('stop()', () => {
    it('should cancel delayed events', done => {
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
        assert.isFalse(called);
        done();
      }, 60);
    });
  });

  describe('options', () => {
    describe('execute', () => {
      it('should not execute actions if execute is false', done => {
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
            assert.isFalse(effect);
            done();
          })
          .start();
      });

      it('should not execute actions if execute is true (default)', done => {
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
            assert.isTrue(effect);
            done();
          })
          .start();
      });

      it('actions should be able to be executed manually with execute()', done => {
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
              onEntry: ctx => {
                effect = ctx.value;
              }
            }
          }
        });

        const service = interpret(machine, { execute: false })
          .onTransition(state => {
            setTimeout(() => {
              service.execute(state);
              assert.isTrue(effect);
              done();
            }, 10);
          })
          .onDone(() => {
            assert.isFalse(effect);
          })
          .start();
      });

      it('actions should be configurable with execute()', done => {
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
          .onTransition(state => {
            setTimeout(() => {
              service.execute(state, {
                doEffect: ctx => {
                  effect = ctx.value;
                }
              });
              assert.isTrue(effect);
              done();
            }, 10);
          })
          .onDone(() => {
            assert.isFalse(effect);
          })
          .start();
      });
    });

    describe('id', () => {
      it('uses the ID specified in the options', () => {
        const service = interpret(lightMachine, { id: 'custom-id' });

        assert.equal(service.id, 'custom-id');
      });

      it('uses the machine ID if not specified', () => {
        const service = interpret(lightMachine);

        assert.equal(service.id, lightMachine.id);
      });
    });

    describe('devTools', () => {
      it('devTools should not be connected by default', () => {
        const service = interpret(lightMachine);

        assert.isFalse(service.options.devTools);
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
          transient: { on: { '': 'next' } },
          next: { on: { FINISH: 'end' } },
          end: { type: 'final' }
        }
      });

      const stateValues: StateValue[] = [];
      const service = interpret(stateMachine)
        .onTransition(current => stateValues.push(current.value))
        .start();
      service.send('START');

      const expectedStateValues = ['idle', 'next'];
      assert.equal(stateValues.length, expectedStateValues.length);
      for (let i = 0; i < expectedStateValues.length; i++) {
        assert.equal(stateValues[i], expectedStateValues[i]);
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
              on: {
                '': [{ target: 'end', cond: 'alwaysFalse' }, { target: 'next' }]
              }
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
        .onTransition(current => stateValues.push(current.value))
        .start();
      service.send('START');

      const expectedStateValues = ['idle', 'next'];
      assert.equal(stateValues.length, expectedStateValues.length);
      for (let i = 0; i < expectedStateValues.length; i++) {
        assert.equal(stateValues[i], expectedStateValues[i]);
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
              actions: assign({ count: ctx => ctx.count + 1 })
            }
          },
          on: {
            '': {
              target: 'finished',
              cond: ctx => ctx.count >= 5
            }
          }
        },
        finished: {
          type: 'final'
        }
      }
    });

    it('should be subscribable', done => {
      let count: number;
      const intervalService = interpret(intervalMachine).start();

      intervalService.subscribe(
        state => (count = state.context.count),
        undefined,
        () => {
          assert.equal(count, 5);
          done();
        }
      );
    });

    it('should be unsubscribable', done => {
      let count: number;
      const intervalService = interpret(intervalMachine).start();

      assert.ok(isObservable(intervalService));

      const subscription = intervalService.subscribe(
        state => (count = state.context.count),
        undefined,
        () => {
          assert.equal(count, 5);
          done();
        }
      );

      setTimeout(() => {
        subscription.unsubscribe();
      }, 15);

      setTimeout(() => {
        assert.deepEqual(count, 1, 'count should not have advanced past 1');
        done();
      }, 500);
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
      assert.doesNotThrow(() => service.start());
    });
  });
});
