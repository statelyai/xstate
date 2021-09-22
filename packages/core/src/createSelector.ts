import { StateMachine } from './types';

/**
 * Allows you to specify a typesafe selector based on a machine definition.
 *
 * @example
 * const getIsToggledOn = createSelector(machine, state => state.matches('toggledOn'));
 *
 */
export const createSelector = <TMachine extends StateMachine<any, any, any>, T>(
  _machine: TMachine,
  selector: (state: TMachine['initialState']) => T
) => selector;
