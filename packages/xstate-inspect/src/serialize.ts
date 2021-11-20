import { State, StateMachine } from 'xstate';
import { Replacer } from './types';
import { stringify } from './utils';

export function serializeState(state: State<any, any>, replacer: Replacer) {
  const scxmlEvent = {
    ...state._event,
    data: replacer('data', state._event.data)
  };

  return {
    ...state.toJSON(),
    context: replacer('context', state.context),
    event: scxmlEvent.data,
    _event: scxmlEvent
  };
}

export function stringifyState(
  state: State<any, any>,
  replacer?: Replacer
): string {
  if (!replacer) {
    return stringify(state);
  }

  return stringify(serializeState(state, replacer));
}

function recursiveReplace(value: any, replacer?: Replacer): any {
  const stringified = stringify(value, replacer);
  if (stringified) {
    return JSON.parse(stringified);
  }
  return undefined;
}

export function stringifyMachine(
  machine: StateMachine<any, any, any>,
  replacer?: Replacer
): string {
  return stringify(machine, (key, value) => {
    if (key === 'context' && typeof value === 'object') {
      return recursiveReplace(value, replacer);
    }
    return value;
  });
}
