import { IStateNodeConfig, IHistory, StateValue } from './types';

export function createHistory(config: IStateNodeConfig): IHistory | undefined {
  if (!config.states) {
    return undefined;
  }

  const history = {
    $current: config.initial
  };

  Object.keys(config.states).forEach(stateId => {
    const state = config.states[stateId];

    if (!state.states) {
      return;
    }

    history[stateId] = createHistory(state);
  });

  return history;
}

export function updateHistory(
  history: IHistory,
  stateValue: StateValue
): IHistory {
  if (typeof stateValue === 'string') {
    return {
      ...history,
      $current: stateValue
    };
  }

  const nextHistory = {
    ...history,
    $current: stateValue
  };

  Object.keys(stateValue).forEach(subStatePath => {
    const subHistory = history[subStatePath] as string;
    const subStateValue = stateValue[subStatePath];

    if (typeof subHistory === 'string') {
      // this will never happen, just making TS happy
      return;
    }

    nextHistory[subStatePath] = updateHistory(subHistory, subStateValue);
  });

  return nextHistory;
}
