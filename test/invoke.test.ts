import { Machine, actions } from '../src/index';
import { interpret } from '../src/interpreter';
import { assign } from '../src/actions';
import { assert } from 'chai';

const childMachine = Machine({
  id: 'child',
  initial: 'init',
  states: {
    init: {
      onEntry: [actions.sendParent('INC'), actions.sendParent('INC')]
    }
  }
});

const parentMachine = Machine(
  {
    id: 'parent',
    context: { count: 0 },
    initial: 'start',
    states: {
      start: {
        activities: [
          {
            id: 'someService',
            type: 'xstate.invoke',
            src: 'child'
          }
        ],
        on: {
          INC: { actions: assign({ count: ctx => ctx.count + 1 }) },
          STOP: 'stop'
        }
      },
      stop: {}
    }
  },
  {
    services: {
      child: childMachine.definition
    }
  }
);

describe('invoke', () => {
  it('should start services (external machines)', () => {
    const interpreter = interpret(parentMachine).start();
    // 1. The 'parent' machine will enter 'start' state
    // 2. The 'child' service will be run with ID 'someService'
    // 3. The 'child' machine will enter 'init' state
    // 4. The 'onEntry' action will be executed, which sends 'INC' to 'parent' machine twice
    // 5. The context will be updated to increment count to 2

    assert.deepEqual(interpreter.state.context, { count: 2 });

    interpreter.send('STOP');
  });
});
