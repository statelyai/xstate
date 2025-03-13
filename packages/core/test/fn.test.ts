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
