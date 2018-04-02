import { StateValue, Action, ActivityMap, EventObject } from './types';
import { STATE_DELIMITER, EMPTY_ACTIVITY_MAP } from './constants';
import { toStateValue } from './utils';

export class State {
  public static from(stateValue: State | StateValue): State {
    if (stateValue instanceof State) {
      return stateValue;
    }

    return new State(toStateValue(stateValue));
  }
  public static inert(stateValue: State | StateValue): State {
    if (stateValue instanceof State) {
      if (!stateValue.actions.length) {
        return stateValue;
      }
      return new State(stateValue.value, stateValue.history, []);
    }

    return State.from(stateValue);
  }

  constructor(
    public value: StateValue,
    public history?: State,
    public actions: Action[] = [],
    public activities: ActivityMap = EMPTY_ACTIVITY_MAP,
    public data: Record<string, any> = {},
    /**
     * Internal event queue
     */
    public events: EventObject[] = []
  ) {}
  public toString(): string | undefined {
    if (typeof this.value === 'string') {
      return this.value;
    }

    const path: string[] = [];
    let marker: StateValue = this.value;

    while (true) {
      if (typeof marker === 'string') {
        path.push(marker);
        break;
      }

      const [firstKey, ...otherKeys] = Object.keys(marker);

      if (otherKeys.length) {
        return undefined;
      }

      path.push(firstKey);
      marker = marker[firstKey];
    }

    return path.join(STATE_DELIMITER);
  }
}
