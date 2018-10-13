import {
  StateValue,
  ActivityMap,
  EventObject,
  StateInterface,
  HistoryValue,
  ActionObject,
  EventType,
  StateValueMap
} from './types';
import { EMPTY_ACTIVITY_MAP } from './constants';
import { matchesState, keys } from './utils';
import { StateTree } from './StateTree';

export function stateValuesEqual(a: StateValue, b: StateValue): boolean {
  if (a === b) {
    return true;
  }

  const aKeys = keys(a as StateValueMap);
  const bKeys = keys(b as StateValueMap);

  return (
    aKeys.length === bKeys.length &&
    aKeys.every(key => stateValuesEqual(a[key], b[key]))
  );
}

export class State<TContext, TEvents extends EventObject = EventObject>
  implements StateInterface<TContext> {
  /**
   * The state node tree representation of the state value.
   */
  public tree?: StateTree;
  /**
   * Creates a new State instance for the given `stateValue` and `context`.
   * @param stateValue
   * @param context
   */
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
  /**
   * Creates a new State instance for the given `stateValue` and `context` with no actions (side-effects).
   * @param stateValue
   * @param context
   */
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

  /**
   * Creates a new State instance.
   * @param value The state value
   * @param context The extended state
   * @param historyValue The tree representing historical values of the state nodes
   * @param history The previous state
   * @param actions An array of action objects to execute as side-effects
   * @param activities A mapping of activities and whether they are started (`true`) or stopped (`false`).
   * @param meta
   * @param events Internal event queue. Should be empty with run-to-completion semantics.
   * @param tree
   */
  constructor(
    public value: StateValue,
    public context: TContext,
    public historyValue?: HistoryValue | undefined,
    public history?: State<TContext>,
    public actions: Array<ActionObject<TContext>> = [],
    public activities: ActivityMap = EMPTY_ACTIVITY_MAP,
    public meta: any = {},
    public events: TEvents[] = [],
    tree?: StateTree
  ) {
    Object.defineProperty(this, 'tree', {
      value: tree,
      enumerable: false
    });
  }

  /**
   * The next events that will cause a transition from the current state.
   */
  public get nextEvents(): EventType[] {
    if (!this.tree) {
      return [];
    }

    return this.tree.nextEvents;
  }

  /**
   * Returns an array of all the string leaf state node paths.
   * @param stateValue
   * @param delimiter The character(s) that separate each subpath in the string state node path.
   */
  public toStrings(
    stateValue: StateValue = this.value,
    delimiter: string = '.'
  ): string[] {
    if (typeof stateValue === 'string') {
      return [stateValue];
    }
    const valueKeys = keys(stateValue);

    return valueKeys.concat(
      ...valueKeys.map(key =>
        this.toStrings(stateValue[key]).map(s => key + delimiter + s)
      )
    );
  }

  /**
   * Whether the current state value is a subset of the given parent state value.
   * @param parentStateValue
   */
  public matches(parentStateValue: StateValue): boolean {
    return matchesState(parentStateValue, this.value);
  }

  /**
   * Indicates whether the state has changed from the previous state. A state is considered "changed" if:
   *
   * - Its value is not equal to its previous value, or:
   * - It has any new actions (side-effects) to execute.
   *
   * An initial state (with no history) will return `undefined`.
   */
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
