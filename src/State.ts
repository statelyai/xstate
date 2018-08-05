import {
  StateValue,
  ActivityMap,
  EventObject,
  Action,
  StateInterface,
  HistoryValue
} from './types';
import { STATE_DELIMITER, EMPTY_ACTIVITY_MAP } from './constants';

export class State<TExtState> implements StateInterface<TExtState> {
  public static from<T>(
    stateValue: State<T> | StateValue,
    extendedState: T
  ): State<T> {
    if (stateValue instanceof State) {
      if (stateValue.ext !== extendedState) {
        return new State<T>(
          stateValue.value,
          extendedState,
          stateValue.historyValue,
          stateValue.history,
          [],
          stateValue.activities,
          {},
          []
        );
      }

      return stateValue;
    }

    return new State(
      stateValue,
      extendedState,
      undefined,
      undefined,
      [],
      undefined,
      undefined,
      []
    );
  }
  public static inert<T>(stateValue: State<T> | StateValue, ext: T): State<T> {
    if (stateValue instanceof State) {
      if (!stateValue.actions.length) {
        return stateValue;
      }
      return new State(
        stateValue.value,
        ext,
        stateValue.historyValue,
        stateValue.history,
        [],
        stateValue.activities,
        undefined,
        []
      );
    }

    return State.from(stateValue, ext);
  }

  constructor(
    public value: StateValue,
    public ext: TExtState,
    public historyValue?: HistoryValue | undefined,
    public history?: State<TExtState>,
    public actions: Array<Action<TExtState>> = [],
    public activities: ActivityMap = EMPTY_ACTIVITY_MAP,
    public data: Record<string, any> = {},
    /**
     * Internal event queue
     */
    public events: EventObject[] = []
  ) {}

  public toStrings(value: StateValue = this.value): string[] {
    if (typeof value === 'string') {
      return [value];
    }
    const keys = Object.keys(value);

    return keys.concat(
      ...keys.map(key => this.toStrings(value[key]).map(s => key + '.' + s))
    );
  }
  public toString(): string {
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
        return '';
      }

      path.push(firstKey);
      marker = marker[firstKey];
    }

    return path.join(STATE_DELIMITER);
  }
}
