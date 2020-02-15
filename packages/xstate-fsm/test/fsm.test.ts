import { createMachine, assign, interpret, StateMachine } from '../src';

describe('@xstate/fsm', () => {
  interface LightContext {
    count: number;
    foo: string | undefined;
    go: boolean;
  }

  type LightEvent =
    | { type: 'TIMER' }
    | { type: 'INC' }
    | { type: 'EMERGENCY'; value: number };

  type LightState =
    | {
        value: 'green';
        context: LightContext & { go: true };
      }
    | {
        value: 'yellow';
        context: LightContext & { go: false };
      };

  const lightConfig: StateMachine.Config<LightContext, LightEvent> = {
    id: 'light',
    initial: 'green',
    context: { count: 0, foo: 'bar', go: true },
    states: {
      green: {
        entry: 'enterGreen',
        exit: [
          'exitGreen',
          assign({ count: ctx => ctx.count + 1 }),
          assign({ count: ctx => ctx.count + 1 }),
          assign<LightContext>({ foo: 'static' }),
          assign({ foo: ctx => ctx.foo + '++' })
        ],
        on: {
          TIMER: {
            target: 'yellow',
            actions: ['g-y 1', 'g-y 2']
          }
        }
      },
      yellow: {
        entry: assign<LightContext>({ go: false }),
        on: {
          INC: { actions: assign({ count: ctx => ctx.count + 1 }) },
          EMERGENCY: {
            target: 'red',
            cond: (ctx, e) => ctx.count + e.value === 2
          }
        }
      },
      red: {}
    }
  };
  const lightFSM = createMachine<LightContext, LightEvent, LightState>(
    lightConfig
  );
  it('should return back the config object', () => {
    expect(lightFSM.config).toBe(lightConfig);
  });
  it('should have the correct initial state', () => {
    const { initialState } = lightFSM;

    expect(initialState.value).toEqual('green');
    expect(initialState.actions).toEqual([{ type: 'enterGreen' }]);
  });
  it('should transition correctly', () => {
    const nextState = lightFSM.transition('green', 'TIMER');
    expect(nextState.value).toEqual('yellow');
    expect(nextState.actions.map(action => action.type)).toEqual([
      'exitGreen',
      'g-y 1',
      'g-y 2'
    ]);
    expect(nextState.context).toEqual({
      count: 2,
      foo: 'static++',
      go: false
    });
  });

  it('should stay on the same state for undefined transitions', () => {
    const nextState = lightFSM.transition('green', 'FAKE' as any);
    expect(nextState.value).toBe('green');
    expect(nextState.actions).toEqual([]);
  });

  it('should throw an error for undefined states', () => {
    expect(() => {
      lightFSM.transition('unknown', 'TIMER');
    }).toThrow();
  });

  it('should work with guards', () => {
    const yellowState = lightFSM.transition('yellow', 'EMERGENCY');
    expect(yellowState.value).toEqual('yellow');

    const redState = lightFSM.transition('yellow', {
      type: 'EMERGENCY',
      value: 2
    });
    expect(redState.value).toEqual('red');
    expect(redState.context.count).toBe(0);

    const yellowOneState = lightFSM.transition('yellow', 'INC');
    const redOneState = lightFSM.transition(yellowOneState, {
      type: 'EMERGENCY',
      value: 1
    });

    expect(redOneState.value).toBe('red');
    expect(redOneState.context.count).toBe(1);
  });

  it('should be changed if state changes', () => {
    expect(lightFSM.transition('green', 'TIMER').changed).toBe(true);
  });

  it('should be changed if any actions occur', () => {
    expect(lightFSM.transition('yellow', 'INC').changed).toBe(true);
  });

  it('should not be changed on unknown transitions', () => {
    expect(lightFSM.transition('yellow', 'UNKNOWN' as any).changed).toBe(false);
  });

  it('should match initialState', () => {
    const { initialState } = lightFSM;

    expect(initialState.matches('green')).toBeTruthy();

    if (initialState.matches('green')) {
      expect(initialState.context.go).toBeTruthy();
    }
  });

  it('should match transition states', () => {
    const { initialState } = lightFSM;
    const nextState = lightFSM.transition(initialState, 'TIMER');

    expect(nextState.matches('yellow')).toBeTruthy();

    if (nextState.matches('yellow')) {
      expect(nextState.context.go).toBeFalsy();
    }
  });
});

describe('interpreter', () => {
  const toggleMachine = createMachine({
    initial: 'active',
    states: {
      active: {
        on: { TOGGLE: 'inactive' }
      },
      inactive: {}
    }
  });

  it('listeners should immediately get the initial state', done => {
    const toggleService = interpret(toggleMachine).start();

    toggleService.subscribe(state => {
      if (state.matches('active')) {
        done();
      }
    });
  });

  it('listeners should subscribe to state changes', done => {
    const toggleService = interpret(toggleMachine).start();

    toggleService.subscribe(state => {
      if (state.matches('inactive')) {
        done();
      }
    });

    toggleService.send('TOGGLE');
  });

  it('should execute actions', done => {
    let executed = false;

    const actionMachine = createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            TOGGLE: {
              target: 'inactive',
              actions: () => {
                executed = true;
              }
            }
          }
        },
        inactive: {}
      }
    });

    const actionService = interpret(actionMachine).start();

    actionService.subscribe(() => {
      if (executed) {
        done();
      }
    });

    actionService.send('TOGGLE');
  });

  it('should execute initial entry action', () => {
    let executed = false;

    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          entry: () => {
            executed = true;
          }
        }
      }
    });

    interpret(machine).start();

    expect(executed).toBe(true);
  });

  it('should lookup string actions in options', () => {
    let executed = false;

    const machine = createMachine(
      {
        initial: 'foo',
        states: {
          foo: {
            entry: 'testAction'
          }
        }
      },
      {
        actions: {
          testAction: () => {
            executed = true;
          }
        }
      }
    );

    interpret(machine).start();

    expect(executed).toBe(true);
  });
});
