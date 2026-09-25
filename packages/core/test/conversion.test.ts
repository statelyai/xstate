import { describe, it, expect } from 'vitest';
import { createMachineFromConfig } from '../src/createMachineFromConfig';
import { initialTransition, transition } from '../src/transition';
import { createMachine } from '../src';

function toPortableJSON<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe('createMachineFromConfig', () => {
  it('should create a machine from a JSON config', () => {
    const machine = createMachineFromConfig(
      {
        context: { count: 42 },
        initial: 'a',
        states: {
          a: {
            entry: [{ type: '@xstate.assign', context: { count: 42 } }],
            on: {
              INC: {
                actions: [{ type: '@xstate.assign', context: { count: 43 } }]
              },
              DEC: {
                actions: [{ type: '@xstate.assign', context: { count: 41 } }]
              },
              NEXT: {
                actions: [{ type: '@xstate.assign', context: { count: 0 } }],
                target: 'b'
              },
              COND_NEXT: {
                guard: { type: 'customGuard' },
                target: 'c'
              }
            }
          },
          b: {
            on: {
              BACK: { target: 'a' }
            }
          },
          c: {}
        }
      },
      {
        guards: {
          customGuard: () => true
        }
      }
    );

    expect(machine.root.states.a).toBeDefined();
    expect(machine.root.states.b).toBeDefined();
    expect(machine.root.states.a.on!['INC']).toBeDefined();
    expect(machine.root.states.a.on!['DEC']).toBeDefined();
    expect(machine.root.states.a.on!['NEXT']).toBeDefined();

    const [initialState] = initialTransition(machine);
    expect(initialState.value).toEqual('a');
    expect(initialState.context).toEqual({ count: 42 });
    const [nextState] = transition(machine, initialState, { type: 'NEXT' });
    expect(nextState.value).toEqual('b');
    expect(nextState.context).toEqual({ count: 0 });
    const [nextState2] = transition(machine, nextState, { type: 'BACK' });
    expect(nextState2.value).toEqual('a');
    expect(nextState2.context).toEqual({ count: 42 });
    const [nextState3] = transition(machine, nextState2, { type: 'COND_NEXT' });
    expect(nextState3.value).toEqual('c');
    expect(nextState3.context).toEqual({ count: 42 });
  });
});
