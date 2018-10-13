import { Machine, actions } from '../src/index';
import { interpret } from '../src/interpreter';
import { assign, invoke, sendParent, send, doneInvoke } from '../src/actions';
import { assert } from 'chai';

const childMachine = Machine({
  id: 'child',
  initial: 'init',
  states: {
    init: {
      onEntry: [actions.sendParent('INC'), actions.sendParent('INC')],
      on: {
        FORWARD_DEC: {
          actions: [
            actions.sendParent('DEC'),
            actions.sendParent('DEC'),
            actions.sendParent('DEC')
          ]
        }
      }
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
        activities: [invoke('child', { id: 'someService', forward: true })],
        on: {
          INC: { actions: assign({ count: ctx => ctx.count + 1 }) },
          DEC: { actions: assign({ count: ctx => ctx.count - 1 }) },
          FORWARD_DEC: undefined,
          STOP: 'stop'
        }
      },
      stop: {}
    }
  },
  {
    services: {
      child: childMachine
    }
  }
);

const fetchMachine = Machine({
  id: 'fetch',
  initial: 'pending',
  states: {
    pending: {
      onEntry: send('RESOLVE'),
      on: {
        RESOLVE: 'success'
      }
    },
    success: {
      type: 'final'
    },
    failure: {
      onEntry: sendParent('REJECT')
    }
  }
});

const fetcherMachine = Machine({
  id: 'fetcher',
  initial: 'waiting',
  states: {
    waiting: {
      activities: invoke(fetchMachine),
      on: {
        [doneInvoke(fetchMachine.id).toString()]: 'received'
      }
    },
    received: {
      type: 'final'
    }
  }
});

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

  it('should forward events to services if forward: true', () => {
    const interpreter = interpret(parentMachine).start();

    interpreter.send('FORWARD_DEC');
    // 1. The 'parent' machine will not do anything (inert transition)
    // 2. The 'FORWARD_DEC' event will be forwarded to the 'child' machine (forward: true)
    // 3. On the 'child' machine, the 'FORWARD_DEC' event sends the 'DEC' action to the 'parent' thrice
    // 4. The context of the 'parent' machine will be updated from 2 to -1

    assert.deepEqual(interpreter.state.context, { count: -1 });
  });

  it('should start services (explicit machines)', done => {
    interpret(fetcherMachine)
      .onDone(state => {
        assert.deepEqual(state.value, 'received');
        done();
      })
      .start();
  });
});
