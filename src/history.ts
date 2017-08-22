import { IStateNodeConfig, IHistory, StateValue } from './types';
import { mapValues } from './utils';

export function createHistory(config: IStateNodeConfig): IHistory | undefined {
  if (!config.states) {
    return undefined;
  }

  const history: Partial<
    IHistory
  > = mapValues(config.states, (state, stateId) => {
    if (!state.states) {
      return;
    }

    return createHistory(state);
  });

  history.$current = config.initial;

  return history as IHistory;
}

export function updateHistory(
  history: IHistory,
  stateValue: StateValue
): IHistory {
  const nextHistory = {
    ...history,
    $current: stateValue
  };

  if (typeof stateValue === 'string') {
    return nextHistory;
  }

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
