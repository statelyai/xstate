import { createActor, initialTransition, transition } from '../src';
import { createMachineFromConfig } from '../src/createMachineFromConfig';

describe('createMachineFromConfig ', () => {
  it('should create a machine from a config', () => {
    const machine = createMachineFromConfig({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: { target: 'b' }
          }
        },
        b: {
          on: {
            NEXT: { target: 'c' }
          }
        },
        c: {}
      }
    });
    const [initialState] = initialTransition(machine);
    expect(initialState.value).toEqual('a');
    const [nextState] = transition(machine, initialState, { type: 'NEXT' });
    expect(nextState.value).toEqual('b');
    const [nextState2] = transition(machine, nextState, { type: 'NEXT' });
    expect(nextState2.value).toEqual('c');
  });
  it('should handle raise actions', () => {
    const machine = createMachineFromConfig({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: {
              actions: [{ type: '@xstate.raise', event: { type: 'TO_B' } }]
            },
            TO_B: { target: 'b' }
          }
        },
        b: {}
      }
    });
    const [initialState] = initialTransition(machine);
    expect(initialState.value).toEqual('a');
    const [nextState] = transition(machine, initialState, { type: 'NEXT' });
    expect(nextState.value).toEqual('b');
  });

  it('should handle emit actions', async () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = createMachineFromConfig({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: {
              actions: [
                {
                  type: '@xstate.emit',
                  event: { type: 'EMITTED', msg: 'hello' }
                }
              ]
            }
          }
        }
      }
    });

    const actor = createActor(machine);
    actor.on('EMITTED', (ev) => {
      expect(ev.msg).toEqual('hello');
      resolve();
    });
    actor.start();
    actor.send({ type: 'NEXT' });
    await promise;
  });
});
