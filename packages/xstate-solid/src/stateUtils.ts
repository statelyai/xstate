import type { SetStoreFunction } from 'solid-js/store';
import { reconcile } from 'solid-js/store';
import type { ActorRef, Interpreter, InterpreterFrom } from 'xstate';
import { State } from 'xstate';
import { isStateLike } from 'xstate/lib/utils';

function isService(value: any): value is Interpreter<any> {
  return 'state' in value && 'machine' in value;
}

/**
 * Reconcile the state of the machine with the current state of the store.
 * Handles primitive values, arrays, and objects.
 * Provides granular reactivity for the state of the machine in SolidJS.
 * @param nextState The next state value to update current store with
 * @param setState A Solid store setter
 */
export const updateState = <NextState extends object | unknown>(
  nextState: NextState,
  setState: SetStoreFunction<NextState>
): void => {
  // Only reconcile each property if nextState is a State class
  if (nextState instanceof State) {
    const keys = Object.keys(nextState) as any[];
    for (const key of keys) {
      // Don't update functions
      if (typeof nextState[key] === 'function') {
        continue;
      }
      // Try to reconcile and fall back to replacing state
      try {
        setState(key, reconcile(nextState[key]));
      } catch {
        setState(key, nextState[key]);
      }
    }
  } else {
    setState(reconcile(nextState));
  }
};

/**
 * Takes in an interpreter or actor ref and returns a State object with reactive
 * methods or if not State, the initial value passed in
 * @param service {InterpreterFrom<any> | ActorRef<any>}
 * @param initialState {State<any> | unknown}
 */
export const deriveServiceState = <
  TService extends InterpreterFrom<any> | ActorRef<any>,
  InitialState extends State<any>
>(
  service: TService,
  initialState: InitialState extends unknown ? unknown : InitialState
): InitialState => {
  if (isService(service) && isStateLike(initialState)) {
    return {
      ...(initialState as object),
      toJSON() {
        return service.state.toJSON();
      },
      toStrings(...args: Parameters<InitialState['toStrings']>) {
        return service.state.toStrings(args[0], args[1]);
      },
      can(...args: Parameters<InitialState['can']>) {
        // tslint:disable-next-line:no-unused-expression
        this.value; // sets state.value to be tracked
        return service.state.can(args[0]);
      },
      hasTag(...args: Parameters<InitialState['hasTag']>) {
        // tslint:disable-next-line:no-unused-expression
        this.tags; // sets state.tags to be tracked
        return service.state.hasTag(args[0]);
      },
      matches(...args: Parameters<InitialState['matches']>) {
        // tslint:disable-next-line:no-unused-expression
        this.value; // sets state.value to be tracked
        return service.state.matches(args[0] as never);
      }
    } as InitialState;
  } else {
    return initialState as InitialState;
  }
};
