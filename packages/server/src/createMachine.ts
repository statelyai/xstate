import {
  asyncVoidNothing,
  extractActions,
  extractTransitions,
  isAsync,
  isFinal,
  isSync
} from './helpers';
import { Machine } from './machine';
import type {
  Config,
  DFS,
  Options,
  State,
  StateDefinition,
  TransitionDefinition
} from './types';

export function createMachine<
  TA = any,
  TC extends Record<string, unknown> = Record<string, unknown>,
  S extends State = State
>(config: Config<TA, TC, S>, options?: Options<TC, TA>) {
  const context = config.context;
  const initial = config.initial;
  const states: StateDefinition<TA, TC>[] = [];
  const __states = Object.entries(config.states);
  const stringStates = __states.map(([key]) => key);

  for (const [value, state] of __states) {
    const matches = <T extends string>(_value: T) => _value === value;
    const source = value;

    const entry = extractActions(state.entry);
    const exit = extractActions(state.exit);

    if (isSync(state)) {
      states.push({
        type: state.type ?? 'sync',
        value,
        entry,
        exit,
        matches,
        transitions: extractTransitions(
          stringStates,
          source,
          state.transitions,
          options
        )
      });
      continue;
    }

    if (isAsync(state)) {
      const promise = options?.promises?.[state.promise] ?? asyncVoidNothing;

      // #region Build onDone
      const onDone: TransitionDefinition<TC, any>[] = extractTransitions(
        stringStates,
        source,
        state.onDone,
        options
      );
      // #endregion

      // #region Build onErrror
      const onError: TransitionDefinition<TC, any>[] = extractTransitions(
        stringStates,
        source,
        state.onError,
        options
      );
      // #endregion

      // #region Build timeout
      const timeout = options?.timeouts?.[state.timeout] ?? 400;

      // #endregion

      states.push({
        type: state.type ?? 'async',
        value,
        entry,
        exit,
        matches,
        promise,
        onDone,
        onError,
        timeout
      });
      continue;
    }

    if (isFinal(state)) {
      states.push({
        type: state.type ?? 'final',
        value,
        entry,
        exit,
        matches
      });
      continue;
    }
  }

  return new Machine<TA, TC, DFS<TA, TC, S>>(
    states as DFS<TA, TC, S>[],
    initial,
    context
  );
}
