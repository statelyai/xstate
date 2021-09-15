import { StateFrom, StateMachine } from 'xstate';

/**
 * Allows you to specify a typesafe selector based on a machine definition.
 *
 * @example
 * const getIsToggedOn = createSelector(machine, state => state.matches('toggledOn'));
 */
export const createSelector = <TMachine extends StateMachine<any, any, any>, T>(
  _machine: TMachine,
  selector: (state: StateFrom<TMachine>) => T
) => selector;
