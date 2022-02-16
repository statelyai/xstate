import { AnyStateMachine, Machine, StateNode } from '../src';
import { flatten } from '../src/utils';

describe('document order', () => {
  it('should specify the correct document order for each state node', () => {
    const machine = Machine({
      id: 'order',
      initial: 'one',
      states: {
        one: {
          initial: 'two',
          states: {
            two: {},
            three: {
              initial: 'four',
              states: {
                four: {},
                five: {
                  initial: 'six',
                  states: {
                    six: {}
                  }
                }
              }
            }
          }
        },
        seven: {
          type: 'parallel',
          states: {
            eight: {
              initial: 'nine',
              states: {
                nine: {},
                ten: {
                  initial: 'eleven',
                  states: {
                    eleven: {},
                    twelve: {}
                  }
                }
              }
            },
            thirteen: {
              type: 'parallel',
              states: {
                fourteen: {},
                fifteen: {}
              }
            }
          }
        }
      }
    });

    function dfs(
      node: AnyStateMachine
    ): StateNode<any, any, any, any, any, any>[] {
      return flatten([
        node as any,
        ...Object.keys(node.states).map((key) => dfs(node.states[key] as any))
      ]);
    }

    const allStateNodeOrders = dfs(machine).map((sn) => [sn.key, sn.order]);

    expect(allStateNodeOrders).toEqual([
      ['order', 0],
      ['one', 1],
      ['two', 2],
      ['three', 3],
      ['four', 4],
      ['five', 5],
      ['six', 6],
      ['seven', 7],
      ['eight', 8],
      ['nine', 9],
      ['ten', 10],
      ['eleven', 11],
      ['twelve', 12],
      ['thirteen', 13],
      ['fourteen', 14],
      ['fifteen', 15]
    ]);
  });
});
