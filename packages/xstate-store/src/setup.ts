import { EventObject } from 'xstate';
import { createStore } from './store';
import {
  Compute,
  EventPayloadMap,
  ExtractEventsFromPayloadMap,
  Store,
  StoreAssigner,
  StoreContext,
  StorePropertyAssigner
} from './types';

type MaybeZod<T> = T extends { _output: infer U } ? U : T;

type EmittedFrom<T extends Record<string, {}>> = {
  [K in keyof T]: Compute<{ type: K } & MaybeZod<T[K]> & EventObject>;
}[keyof T];

export function setup<const T extends { emitted: Record<string, {}> }>({
  emitted
}: T): {
  createStore: <
    TContext extends StoreContext,
    TEventPayloadMap extends EventPayloadMap
  >(
    initialContext: TContext,
    transitions: {
      [K in keyof TEventPayloadMap & string]:
        | StoreAssigner<
            NoInfer<TContext>,
            { type: K } & TEventPayloadMap[K],
            EmittedFrom<T['emitted']>
          >
        | StorePropertyAssigner<
            NoInfer<TContext>,
            { type: K } & TEventPayloadMap[K],
            EmittedFrom<T['emitted']>
          >;
    }
  ) => Store<
    TContext,
    ExtractEventsFromPayloadMap<TEventPayloadMap>,
    EmittedFrom<T['emitted']>
  >;
} {
  return {
    createStore
  };
}
