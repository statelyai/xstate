import { State, StateMachine } from 'xstate';
import { Replacer } from './types';
import { stringify } from './utils';

export function selectivelyStringify<T extends object>(
  value: T,
  keys: Array<keyof T>,
  replacer?: Replacer
): string {
  const selected: any = {};

  for (const key of keys) {
    selected[key] = value[key];
  }

  const serialized = JSON.parse(stringify(selected, replacer));
  return stringify({
    ...value,
    ...serialized
  });
}

export function stringifyState(
  state: State<any, any>,
  replacer?: Replacer
): string {
  return selectivelyStringify(state, ['context', 'event', '_event'], replacer);
}

export function stringifyMachine(
  machine: StateMachine<any, any, any>,
  replacer?: Replacer
): string {
  return selectivelyStringify(machine, ['context'], replacer);
}
