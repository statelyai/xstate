import type { EventObject, MachineContext, Subscribable, Values } from 'xstate';
import { InteropObservable } from 'xstate';

export type EventPayloadMap = Record<string, {} | null | undefined>;

export type ExtractEventsFromPayloadMap<T extends EventPayloadMap> = Values<{
  [K in keyof T & string]: T[K] & { type: K };
}>;

export type Recipe<T, TReturn> = (state: T) => TReturn;

export type StoreAssigner<
  TContext extends MachineContext,
  TEvent extends EventObject
> = (context: TContext, event: TEvent) => Partial<TContext>;
export type StoreCompleteAssigner<TContext, TEvent extends EventObject> = (
  ctx: TContext,
  ev: TEvent
) => TContext;
export type StorePartialAssigner<
  TContext,
  TEvent extends EventObject,
  K extends keyof TContext
> = (ctx: TContext, ev: TEvent) => Partial<TContext>[K];
export type StorePropertyAssigner<TContext, TEvent extends EventObject> = {
  [K in keyof TContext]?:
    | TContext[K]
    | StorePartialAssigner<TContext, TEvent, K>;
};

export interface StoreSnapshot<TContext> {
  status: 'active';
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
