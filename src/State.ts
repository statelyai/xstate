import {
  StateValue,
  ActivityMap,
  EventObject,
  StateInterface,
  HistoryValue,
  ActionObject
} from './types';
import { EMPTY_ACTIVITY_MAP } from './constants';
import { matchesState } from '.';
import { stateValuesEqual } from './utils';

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
    public actions: Array<ActionObject<TExtState>> = [],
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

  public matches(parentStateValue: StateValue): boolean {
    return matchesState(parentStateValue, this.value);
  }

  public get changed(): boolean {
    if (!this.history) {
      return false;
    }

    return (
      !!this.actions.length ||
      (typeof this.history.value !== this.value
        ? true
        : typeof this.value === 'string'
          ? this.value !== this.history.value
          : stateValuesEqual(this.value, this.history.value))
    );
  }
}
