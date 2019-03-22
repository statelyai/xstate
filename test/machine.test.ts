import { assert } from 'chai';
import { Machine, interpret } from '../src/index';
import { State } from '../src/State';

const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
      on: {
        PED_COUNTDOWN: 'wait'
      }
    },
    wait: {
      on: {
        PED_COUNTDOWN: 'stop'
      }
    },
    stop: {}
  }
};

interface LightStateSchema {
  states: {
    green: any;
    yellow: any;
    red: any;
  };
}

const lightMachine = Machine<undefined, LightStateSchema>({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow',
        POWER_OUTAGE: 'red',
        FORBIDDEN_EVENT: undefined
      }
    },
    yellow: {
      on: {
        TIMER: 'red',
        POWER_OUTAGE: 'red'
      }
    },
    red: {
      on: {
        TIMER: 'green',
        POWER_OUTAGE: 'red'
      },
      ...pedestrianStates
    }
  }
});

const configMachine = Machine(
  {
    id: 'config',
    initial: 'foo',
    context: {
      foo: 'bar'
    },
    states: {
      foo: {
        onEntry: 'entryAction',
        on: {
          EVENT: {
            target: 'bar',
            cond: 'someCondition'
          }
        }
      },
      bar: {}
    }
  },
  {
    actions: {
      entryAction: () => {
        throw new Error('original entry');
      }
    },
    guards: {
      someCondition: () => false
    }
  }
);

describe('machine', () => {
  describe('machine.states', () => {
    it('should properly register machine states', () => {
      assert.deepEqual(Object.keys(lightMachine.states), [
        'green',
        'yellow',
        'red'
      ]);
    });
  });

  describe('machine.events', () => {
    it('should return the set of events accepted by machine', () => {
      assert.sameMembers(lightMachine.events, [
        'TIMER',
        'POWER_OUTAGE',
        'PED_COUNTDOWN'
      ]);
    });
  });

  describe('machine.initialState', () => {
    it('should return a State instance', () => {
      assert.instanceOf(lightMachine.initialState, State);
    });

    it('should return the initial state', () => {
      assert.equal(lightMachine.initialState.value, 'green');
    });
  });

  describe('machine.history', () => {
    it('should not retain previous history', () => {
      const next = lightMachine.transition(lightMachine.initialState, 'TIMER');
      const following = lightMachine.transition(next, 'TIMER');
      assert.isUndefined(following!.history!.history);
    });
  });

  describe('machine.withConfig', () => {
    it('should override guards and actions', () => {
      const differentMachine = configMachine.withConfig({
        actions: {
          entryAction: () => {
            throw new Error('new entry');
          }
        },
        guards: { someCondition: () => true }
      });

      assert.deepEqual(
        differentMachine.context,
        { foo: 'bar' },
        'context should be untouched'
      );

      const service = interpret(differentMachine);

      assert.throws(
        () => service.start(),
        /new entry/,
        'different action should be used'
      );

      assert.deepEqual(
        differentMachine.transition('foo', 'EVENT').value,
        'bar'
      );
    });

    it('should not override context if not defined', () => {
      const differentMachine = configMachine.withConfig({});

      assert.deepEqual(
        differentMachine.initialState.context,
        configMachine.context
      );
    });

    it('should override context (second argument)', () => {
      const differentMachine = configMachine.withConfig(
        {},
        { foo: 'different' }
      );

      assert.deepEqual(differentMachine.initialState.context, {
        foo: 'different'
      });
    });
  });

  describe('machine.resolveState()', () => {
    const resolveMachine = Machine({
      id: 'resolve',
      initial: 'foo',
      states: {
        foo: {
          initial: 'one',
          states: {
            one: {
              type: 'parallel',
              states: {
                a: {
                  initial: 'aa',
                  states: { aa: {} }
                },
                b: {
                  initial: 'bb',
                  states: { bb: {} }
                }
              },
              on: {
                TO_TWO: 'two'
              }
            },
            two: {
              on: { TO_ONE: 'one' }
            }
          },
          on: {
            TO_BAR: 'bar'
          }
        },
        bar: {
          on: {
            TO_FOO: 'foo'
          }
        }
      }
    });

    it('should resolve the state value', () => {
      const tempState = State.from('foo');

      const resolvedState = resolveMachine.resolveState(tempState);

      assert.deepEqual(resolvedState.value, {
        foo: { one: { a: 'aa', b: 'bb' } }
      });
    });

    it('should resolve the state tree (implicit via events)', () => {
      const tempState = State.from('foo');

      const resolvedState = resolveMachine.resolveState(tempState);

      assert.deepEqual(resolvedState.nextEvents, ['TO_BAR']);
    });
  });

  describe('versioning', () => {
    it('should allow a version to be specified', () => {
      const versionMachine = Machine({
        id: 'version',
        version: '1.0.4',
        states: {}
      });

      assert.equal(versionMachine.version, '1.0.4');
    });

    it('should show the version on state nodes', () => {
      const versionMachine = Machine({
        id: 'version',
        version: '1.0.4',
        states: {
          foo: {
            id: 'foo'
          }
        }
      });

      const fooStateNode = versionMachine.getStateNodeById('foo');

      assert.equal(fooStateNode.version, '1.0.4');
    });
  });
});

describe('StateNode', () => {
  it('should list transitions', () => {
    const greenNode = lightMachine.states.green;

    const transitions = greenNode.transitions;

    assert.deepEqual(transitions.map(t => t.event), [
      'TIMER',
      'POWER_OUTAGE',
      'FORBIDDEN_EVENT'
    ]);
  });
});
