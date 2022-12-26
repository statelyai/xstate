import type { State } from '../src/State';
import { ActionFunction, BaseActionObject } from '../src/types';

interface ExecutableActionObject {
  type: string;
  params: Record<string, any>;
  make: (state: State<any, any>) => BaseActionObject;
}

export function createExecutableAction(
  action: BaseActionObject,
  exec: ActionFunction<any, any>
): ExecutableActionObject {
  return {
    type: action.type,
    params: action.params ?? {},
    make: (state: State<any, any>) => {
      const a: BaseActionObject = {
        type: action.type,
        params: action.params,
        execute2: (_actorCtx) => {
          return exec(state.context, state.event, {
            action: a,
            _event: state._event,
            state
          });
        }
      };

      return a;
    }
  };
}

export function isExecutableAction(
  action: BaseActionObject
): action is ExecutableActionObject {
  return 'make' in action;
}
