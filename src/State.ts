import {
  StateValue,
  ActivityMap,
  EventObject,
  StateInterface,
  HistoryValue,
  ActionObject,
  EventType
} from './types';
import { EMPTY_ACTIVITY_MAP } from './constants';
import { matchesState } from '.';
import { stateValuesEqual } from './utils';
import { StateTree } from './StateTree';

export class State<TContext, TEvents extends EventObject = EventObject>
  implements StateInterface<TContext> {
  public tree?: StateTree;
  public static from<TC, TE extends EventObject = EventObject>(
    stateValue: State<TC, TE> | StateValue,
    context: TC
  ): State<TC, TE> {
    if (stateValue instanceof State) {
      if (stateValue.context !== context) {
        return new State<TC, TE>(
          stateValue.value,
          context,
          stateValue.historyValue,
          stateValue.history,
          [],
          stateValue.activities,
          {},
          [],
          stateValue.tree
        );
      }

      return stateValue;
    }

    return new State<TC, TE>(
      stateValue,
      context,
      undefined,
      undefined,
      [],
      undefined,
      undefined,
      []
    );
  }
  public static inert<TC, TE extends EventObject = EventObject>(
    stateValue: State<TC> | StateValue,
    context: TC
  ): State<TC, TE> {
    if (stateValue instanceof State) {
      if (!stateValue.actions.length) {
        return stateValue as State<TC, TE>;
      }
      return new State(
        stateValue.value,
        context,
        stateValue.historyValue,
        stateValue.history,
        undefined,
        stateValue.activities,
        undefined,
        undefined,
        stateValue.tree
      );
    }

    return State.from<TC, TE>(stateValue, context);
  }

  constructor(
    public value: StateValue,
    public context: TContext,
    public historyValue?: HistoryValue | undefined,
    public history?: State<TContext>,
    public actions: Array<ActionObject<TContext>> = [],
    public activities: ActivityMap = EMPTY_ACTIVITY_MAP,
    public data: Record<string, any> = {},
    /**
     * Internal event queue
     */
    public events: TEvents[] = [],
    tree?: StateTree
  ) {
    Object.defineProperty(this, 'tree', {
      value: tree,
      enumerable: false
    });
  }

  public get nextEvents(): EventType[] {
    if (!this.tree) {
      return [];
    }

    return this.tree.nextEvents;
  }

  public toStrings(
    value: StateValue = this.value,
    delimiter: string = '.'
  ): string[] {
    if (typeof value === 'string') {
      return [value];
    }
    const keys = Object.keys(value);

    return keys.concat(
      ...keys.map(key =>
        this.toStrings(value[key]).map(s => key + delimiter + s)
      )
    );
  }

  public matches(parentStateValue: StateValue): boolean {
    return matchesState(parentStateValue, this.value);
  }

  public get changed(): boolean | undefined {
    if (!this.history) {
      return undefined;
    }

    return (
      !!this.actions.length ||
      (typeof this.history.value !== typeof this.value
        ? true
        : typeof this.value === 'string'
          ? this.value !== this.history.value
          : stateValuesEqual(this.value, this.history.value))
    );
  }
}
