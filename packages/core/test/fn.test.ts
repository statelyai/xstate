import { initialTransition, transition } from '../src';
import { createMachine } from '../src/createMachine';

it('should work with fn targets', () => {
  const machine = createMachine({
    initial: 'active',
    states: {
      active: {
        on: {
          toggle: {
            fn: () => ({ target: 'inactive' })
          }
        }
      },
      inactive: {}
    }
  });

  const [initialState] = initialTransition(machine);

  const [nextState] = transition(machine, initialState, { type: 'toggle' });

  expect(nextState.value).toEqual('inactive');
});

it('should work with fn actions', () => {
  const machine = createMachine({
    initial: 'active',
    states: {
      active: {
        on: {
          toggle: {
            fn: ({ enqueue }) => {
              enqueue({ type: 'something' });
            }
          }
        }
      },
      inactive: {}
    }
  });

  const [initialState] = initialTransition(machine);

  const [, actions] = transition(machine, initialState, { type: 'toggle' });

  expect(actions).toContainEqual(
    expect.objectContaining({
      type: 'something'
    })
  );
});

it('should work with both fn actions and target', () => {
  const machine = createMachine({
    initial: 'active',
    states: {
      active: {
        on: {
          toggle: {
            fn: ({ enqueue }) => {
              enqueue({ type: 'something' });

              return {
                target: 'inactive'
              };
            }
          }
        }
      },
      inactive: {}
    }
  });

  const [initialState] = initialTransition(machine);

  const [nextState, actions] = transition(machine, initialState, {
    type: 'toggle'
  });

  expect(actions).toContainEqual(
    expect.objectContaining({
      type: 'something'
    })
  );

  expect(nextState.value).toEqual('inactive');
});

it('should work with conditions', () => {
  const machine = createMachine({
    initial: 'active',
    context: {
      count: 0
    },
    states: {
      active: {
        on: {
          increment: {
            fn: ({ context }) => ({
              context: {
                ...context,
                count: context.count + 1
              }
            })
          },
          toggle: {
            fn: ({ context, enqueue }) => {
              enqueue({ type: 'something' });

              if (context.count > 0) {
                return { target: 'inactive' };
              }

              enqueue({ type: 'invalid' });

              return undefined;
            }
          }
        }
      },
      inactive: {}
    }
  });

  const [initialState] = initialTransition(machine);

  const [nextState, actions] = transition(machine, initialState, {
    type: 'toggle'
  });

  expect(actions).toContainEqual(
    expect.objectContaining({
      type: 'something'
    })
  );

  expect(actions).toContainEqual(
    expect.objectContaining({
      type: 'invalid'
    })
  );

  expect(nextState.value).toEqual('active');

  const [nextState2] = transition(machine, nextState, {
    type: 'increment'
  });

  const [nextState3, actions3] = transition(machine, nextState2, {
    type: 'toggle'
  });

  expect(nextState3.value).toEqual('inactive');

  expect(actions3).toContainEqual(
    expect.objectContaining({
      type: 'something'
    })
  );
});
