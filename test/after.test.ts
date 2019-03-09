import { assert } from 'chai';
import { Machine } from '../src/index';
import { after, cancel, send, actionTypes } from '../src/actions';

const lightMachine = Machine({
  id: 'light',
  initial: 'green',
  context: {
    canTurnGreen: true
  },
  states: {
    green: {
      after: {
        1000: 'yellow'
      }
    },
    yellow: {
      after: {
        1000: [{ target: 'red' }]
      }
    },
    red: {
      after: [{ delay: 1000, target: 'green' }]
    }
  }
});

describe('delayed transitions', () => {
  it('should resolve transitions', () => {
    assert.deepEqual(lightMachine.states.green.after, [
      {
        target: 'yellow',
        delay: 1000,
        event: after(1000, 'light.green'),
        actions: []
      }
    ]);
    assert.deepEqual(lightMachine.states.yellow.after, [
      {
        target: 'red',
        cond: undefined,
        delay: 1000,
        event: after(1000, 'light.yellow'),
        actions: []
      }
    ]);
    assert.deepEqual(lightMachine.states.red.after, [
      {
        target: 'green',
        cond: undefined,
        delay: 1000,
        event: after(1000, 'light.red'),
        actions: []
      }
    ]);
  });

  it('should transition after delay', () => {
    const nextState = lightMachine.transition(
      lightMachine.initialState,
      after(1000, 'light.green')
    );

    assert.deepEqual(nextState.value, 'yellow');
    assert.deepEqual(nextState.actions, [
      cancel(after(1000, 'light.green')),
      send(after(1000, 'light.yellow'), { delay: 1000 })
    ]);
  });

  it('should format transitions properly', () => {
    const greenNode = lightMachine.states.green;

    const transitions = greenNode.transitions;

    assert.deepEqual(transitions.map(t => t.event), [
      after(1000, greenNode.id)
    ]);
  });

  describe('delay expressions', () => {
    const delayExprMachine = Machine(
      {
        id: 'delayExpr',
        initial: 'inactive',
        context: {
          delay: 1000
        },
        states: {
          inactive: {
            after: [
              {
                delay: ctx => ctx.delay,
                target: 'active'
              }
            ],
            on: {
              ACTIVATE: 'active',
              NOEXPR: 'activeNoExpr'
            }
          },
          active: {
            after: [
              {
                delay: 'someDelay',
                target: 'inactive'
              }
            ]
          },
          activeNoExpr: {
            after: [
              {
                delay: 'nonExistantDelay',
                target: 'inactive'
              }
            ]
          }
        }
      },
      {
        delays: {
          someDelay: (ctx, event) => ctx.delay + (event as any).delay
        }
      }
    );

    it('should evaluate the expression (function) to determine the delay', () => {
      const { initialState } = delayExprMachine;

      const sendActions = initialState.actions.filter(
        a => a.type === actionTypes.send
      );

      assert.lengthOf(sendActions, 1);

      assert.equal(sendActions[0].delay, 1000);
    });

    it('should evaluate the expression (string) to determine the delay', () => {
      const { initialState } = delayExprMachine;
      const activeState = delayExprMachine.transition(initialState, {
        type: 'ACTIVATE',
        delay: 500
      });

      const sendActions = activeState.actions.filter(
        a => a.type === actionTypes.send
      );

      assert.lengthOf(sendActions, 1);

      assert.equal(sendActions[0].delay, 1000 + 500);
    });

    it('should send the expression (string) as delay if expression not found', () => {
      const { initialState } = delayExprMachine;
      const activeState = delayExprMachine.transition(initialState, {
        type: 'NOEXPR',
        delay: 500
      });

      const sendActions = activeState.actions.filter(
        a => a.type === actionTypes.send
      );

      assert.lengthOf(sendActions, 1);

      assert.equal(sendActions[0].delay, 'nonExistantDelay');
    });
  });
});
