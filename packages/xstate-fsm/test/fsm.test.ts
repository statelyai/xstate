import { FSM, assign } from '../src';

describe('@xstate/fsm', () => {
  const lightFSM = FSM({
    id: 'light',
    initial: 'green',
    context: { count: 0, foo: 'bar' },
    states: {
      green: {
        entry: 'enterGreen',
        exit: [
          'exitGreen',
          assign({ count: ctx => ctx.count + 1 }),
          assign({ count: ctx => ctx.count + 1 }),
          assign({ foo: 'static' }),
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
      foo: 'static++'
    });
  });

  it('should stay on the same state for undefined transitions', () => {
    const nextState = lightFSM.transition('green', 'FAKE');
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

  it('should not be changed on unkonwn transitions', () => {
    expect(lightFSM.transition('yellow', 'UNKNOWN').changed).toBe(false);
  });
});
