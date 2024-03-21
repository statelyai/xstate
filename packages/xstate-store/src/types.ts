import type { EventObject, Subscribable, Values } from 'xstate';
import { InteropObservable } from 'xstate';

export type EventPayloadMap = Record<string, {} | null | undefined>;

export type ExtractEventsFromPayloadMap<T extends EventPayloadMap> = Values<{
  [K in keyof T & string]: T[K] & { type: K };
}>;

export type Recipe<T, TReturn> = (state: T) => TReturn;

export type Assigner<TContext, TEvent extends EventObject> = (
  ctx: TContext,
  ev: TEvent
) => Partial<TContext>;
export type CompleteAssigner<TContext, TEvent extends EventObject> = (
  ctx: TContext,
  ev: TEvent
) => TContext;
export type PartialAssigner<
  TContext,
  TEvent extends EventObject,
  K extends keyof TContext
> = (ctx: TContext, ev: TEvent) => Partial<TContext>[K];
export type PropertyAssigner<TContext, TEvent extends EventObject> = {
  [K in keyof TContext]?: TContext[K] | PartialAssigner<TContext, TEvent, K>;
};

export interface StoreSnapshot<TContext> {
  status: 'active'; // TODO: it can only be active
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

export type SnapshotFromStore<TStore extends Store<any, any>> =
  TStore extends Store<infer TContext, any> ? StoreSnapshot<TContext> : never;
