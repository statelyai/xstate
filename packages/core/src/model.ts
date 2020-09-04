import { assign } from './actions';
import { AssignAction, Assigner, EventObject, PropertyAssigner } from './types';
import { mapValues } from './utils';

export function createModel<TContext, TEvent extends EventObject>(
  initialState: TContext
): {
  context: TContext;
  withUpdaters: <
    T extends {
      [key: string]:
        | Assigner<TContext, TEvent>
        | PropertyAssigner<TContext, TEvent>;
    }
  >(
    assigners: T
  ) => {
    context: TContext;
    actions: {
      [K in keyof T]: AssignAction<TContext, TEvent>;
    };
  };
} {
  return {
    context: initialState,
    withUpdaters: (assigners) => {
      return {
        context: initialState,
        actions: mapValues(assigners, (assignment) => {
          return assign(assignment);
        }) as any
      };
    }
  };
}
