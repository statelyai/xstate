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

type SetupOutput<TEmitted extends EventObject> = {
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
            TEmitted
          >
        | StorePropertyAssigner<
            NoInfer<TContext>,
            { type: K } & TEventPayloadMap[K],
            TEmitted
          >;
    }
  ) => Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>, TEmitted>;
};

export function setup<
  const T extends { schemas: { emitted: Record<string, {}> } }
>({ schemas }: T): SetupOutput<EmittedFrom<T['schemas']['emitted']>>;
export function setup<const T extends { types: { emitted: EventObject } }>({
  types
}: T): SetupOutput<T['types']['emitted']>;
export function setup(arg: unknown) {
  return {
    createStore
  };
}
