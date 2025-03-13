// @ts-nocheck
import { EventObject, MachineContext, MetaObject } from './types';

type EnqueueObj<TContext extends MachineContext, TEvent extends EventObject> = {
  context: TContext;
  event: TEvent;
  enqueue: (fn: any) => void;
};

type StateTransition<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TStateMap extends Record<string, any>
> = (obj: EnqueueObj<TContext, TEvent>) => {
  target: keyof TStateMap;
  context: TContext;
};

type StateConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TStateMap extends Record<string, any>
> = {
  entry?: (obj: EnqueueObj<TContext, TEvent>) => void;
  exit?: (obj: EnqueueObj<TContext, TEvent>) => void;
  on?: {
    [K in TEvent['type']]?: StateTransition<TContext, TEvent, TStateMap>;
  };
  after?: {
    [K in string | number]: StateTransition<TContext, TEvent, TStateMap>;
  };
  always?: StateTransition<TContext, TEvent, TStateMap>;
  meta?: MetaObject;
  id?: string;
  tags?: string[];
  description?: string;
} & (
  | {
      type: 'parallel';
      initial?: never;
      states: States<TContext, TEvent, TStateMap>;
    }
  | {
      type: 'final';
      initial?: never;
      states?: never;
    }
  | {
      type: 'history';
      history?: 'shallow' | 'deep';
      default?: keyof TStateMap;
    }
  | {
      type?: 'compound';
      initial: NoInfer<keyof TStateMap>;
      states: States<TContext, TEvent, TStateMap>;
    }
  | {
      type?: 'atomic';
      initial?: never;
      states?: never;
    }
);

type States<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TStateMap extends Record<string, any>
> = {
  [K in keyof TStateMap]: StateConfig<TContext, TEvent, TStateMap>;
};

export function createMachine2<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TStateMap extends Record<string, any>
>(
  config: {
    context: TContext;
    version?: string;
  } & StateConfig<TContext, TEvent, TStateMap>
) {}

const light = createMachine2({
  context: {},
  initial: 'green',
  states: {
    green: {
      on: {
        timer: () => ({
          target: 'yellow',
          context: {}
        })
      }
    },
    yellow: {
      on: {
        timer: () => ({
          target: 'red',
          context: {}
        })
      }
    },
    red: {
      on: {
        timer: () => ({
          target: 'green',
          context: {}
        })
      }
    },
    hist: {
      type: 'history',
      history: 'shallow'
    }
  }
});

light;
