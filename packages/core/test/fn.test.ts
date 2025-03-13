import { initialTransition, transition } from '../src';
import { createMachine } from '../src/createMachine';

it.only('should work with fn targets', () => {
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
