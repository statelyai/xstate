import {
  StateValue,
  ActivityMap,
  EventObject,
  Action,
  StateInterface,
  HistoryValue
} from './types';
import { STATE_DELIMITER, EMPTY_ACTIVITY_MAP } from './constants';

export class State<TExtState = any> implements StateInterface<TExtState> {
  public static from<T>(
    stateValue: State<T> | StateValue,
    extendedState?: T
  ): State<T> {
    if (stateValue instanceof State) {
      if (stateValue.ext !== extendedState) {
        return new State(
          stateValue.value,
          stateValue.historyValue,
          stateValue.history,
          [],
          stateValue.activities,
          extendedState
        );
      }

      return stateValue;
    }

    return new State(
      stateValue,
      undefined,
      undefined,
      [],
      undefined,
      undefined,
      [],
      extendedState
    );
  }
  public static inert<T>(stateValue: State<T> | StateValue, ext?: T): State<T> {
    if (stateValue instanceof State) {
      if (!stateValue.actions.length) {
        return stateValue;
      }
      return new State(
        stateValue.value,
        stateValue.historyValue,
        stateValue.history,
        [],
        stateValue.activities,
        undefined,
        [],
        ext
      );
    }

    return State.from(stateValue);
  }

  constructor(
    public value: StateValue,
    public historyValue?: HistoryValue | undefined,
    public history?: State,
    public actions: Action[] = [],
    public activities: ActivityMap = EMPTY_ACTIVITY_MAP,
    public data: Record<string, any> = {},
    /**
     * Internal event queue
     */
    public events: EventObject[] = [],
    public ext?: TExtState
  ) {}
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
