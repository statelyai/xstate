import { ActionObject } from '.';
import { EventObject } from './types';

export interface ContextModel<TC, TE extends EventObject> {
  context: TC;
  actions: {
    [key: string]: ActionObject<TC, TE>;
  };
  withActions: <
    T extends {
      [key: string]: ActionObject<TC, TE>;
    }
  >(
    actions: T
  ) => ContextModel<TC, TE> & {
    actions: T;
  };
}

export function createModel<TContext, TEvent extends EventObject>(
  initialState: TContext
): ContextModel<TContext, TEvent> {
  const model: ContextModel<TContext, TEvent> = {
    context: initialState,
    actions: {},
    withActions: (actions) => {
      return {
        ...model,
        actions
      };
    }
  };

  return model;
}

export function assertEvent<TE extends EventObject, TType extends TE['type']>(
  event: TE,
  type: TType
): event is TE & { type: TType } {
  return event.type === type;
}
