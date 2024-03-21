import type { EventObject, Subscribable, Values, NoInfer } from 'xstate';
import { InteropObservable } from 'xstate';

export type EventPayloadMap = Record<string, {} | null | undefined>;

export type ExtractEventsFromPayloadMap<T extends EventPayloadMap> = Values<{
  [K in keyof T & string]: T[K] & { type: K };
}>;

export type Recipe<T, TReturn> = (state: T) => TReturn;

export type Assigner<TC, TE extends EventObject> = (
  ctx: TC,
  ev: TE
) => Partial<TC>;
export type PropertyAssigner<TC, TE extends EventObject> = {
  [K in keyof TC]?: TC[K] | ((ctx: TC, ev: TE) => Partial<TC>[K]);
};

export interface StoreSnapshot<TContext> {
  context: TContext;
}

/**
 * An actor-like object that:
 * - has its own state
 * - can receive events
 * - is observable
 */
export interface Store<TContext, Ev extends EventObject>
  extends Subscribable<StoreSnapshot<TContext>>,
    InteropObservable<StoreSnapshot<TContext>> {
  send: (event: Ev) => void;
  getSnapshot: () => StoreSnapshot<TContext>;
  getInitialSnapshot: () => StoreSnapshot<TContext>;
}

export type ContextFromStore<TStore extends Store<any, any>> =
  TStore extends Store<infer TContext, any> ? TContext : never;
