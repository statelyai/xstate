import type { ActorRef, Interpreter, InterpreterFrom } from 'xstate';
import { State } from 'xstate';
import { isStateLike } from 'xstate/lib/utils';

function isService(value: any): value is Interpreter<any> {
  return 'state' in value && 'machine' in value;
}

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
        this.value; // sets state.tags to be tracked
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
