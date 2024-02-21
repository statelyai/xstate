import { produce } from 'immer';
import type {
  EventObject,
  InteropSubscribable,
  MachineContext,
  Values,
  InteropObservable,
  Observer,
  Subscribable
} from 'xstate';

const symbolObservable: typeof Symbol.observable = (() =>
  (typeof Symbol === 'function' && Symbol.observable) ||
  '@@observable')() as any;

export function toObserver<T>(
  nextHandler?: Observer<T> | ((value: T) => void),
  errorHandler?: (error: any) => void,
  completionHandler?: () => void
): Observer<T> {
  const isObserver = typeof nextHandler === 'object';
  const self = isObserver ? nextHandler : undefined;

  return {
    next: (isObserver ? nextHandler.next : nextHandler)?.bind(self),
    error: (isObserver ? nextHandler.error : errorHandler)?.bind(self),
    complete: (isObserver ? nextHandler.complete : completionHandler)?.bind(
      self
    )
  };
}

export interface Store<T, Ev extends EventObject>
  extends Subscribable<T>,
    InteropObservable<T> {
  send: (event: Ev) => void;
  getSnapshot: () => T;
  getInitialSnapshot: () => T;
  select: <TSelected>(selector: (ctx: T) => TSelected) => TSelected;
}

type EventPayloadMap = Record<string, {} | null | undefined>;

type ExtractEventsFromPayloadMap<T extends EventPayloadMap> = Values<{
  [K in keyof T & string]: T[K] & { type: K };
}>;

type Recipe<T, TReturn> = (state: T) => TReturn;

function defaultSetter<T>(ctx: T, recipe: Recipe<T, T>): T {
  return recipe(ctx);
}

export function createStoreWithProducer<
  TProducer extends (
    ctx: NoInfer<TContext>,
    recipe: (ctx: NoInfer<TContext>) => void
  ) => NoInfer<TContext>,
  TContext extends MachineContext,
  TEventPayloadMap extends EventPayloadMap
>(
  producer: TProducer,
  context: TContext,
  transitions: {
    [K in keyof TEventPayloadMap]: (
      ctx: NoInfer<TContext>,
      ev: TEventPayloadMap[K]
    ) => void;
  }
) {
  return createStore(context, transitions as any, (ctx, recipe) =>
    producer(ctx, recipe)
  );
}

export function createStore<
  TContext extends MachineContext,
  TEventPayloadMap extends EventPayloadMap
>(
  context: TContext,
  transitions: {
    [K in keyof TEventPayloadMap]: (
      ctx: NoInfer<TContext>,
      ev: TEventPayloadMap[K]
    ) => NoInfer<TContext>;
  },
  updater?: (
    ctx: NoInfer<TContext>,
    recipe: (ctx: NoInfer<TContext>) => NoInfer<TContext>
  ) => NoInfer<TContext>
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>> {
  const setter = updater ?? defaultSetter;
  const initialCtx = context;
  let ctx = context;
  function receive(ev: ExtractEventsFromPayloadMap<TEventPayloadMap>) {
    const fn =
      transitions?.[
        ev.type as ExtractEventsFromPayloadMap<TEventPayloadMap>['type']
      ];

    ctx = setter(ctx, (d) => fn?.(d, ev as any));

    // fn?.(ctx, ev as any);
    // const cloned = deepClone(ctx);
    const cloned = ctx;
    observers?.forEach((o) => o.next?.(cloned));
  }
  let observers: Set<Observer<any>> | undefined;

  const store: Store<
    TContext,
    ExtractEventsFromPayloadMap<TEventPayloadMap>
  > = {
    send(ev) {
      receive(ev as unknown as ExtractEventsFromPayloadMap<TEventPayloadMap>);
    },
    getSnapshot() {
      return ctx;
    },
    getInitialSnapshot() {
      return initialCtx;
    },
    subscribe(observerOrFn) {
      const observer = toObserver(observerOrFn);
      observers ??= new Set();
      observers.add(observer);

      return {
        unsubscribe() {
          return observers?.delete(observer);
        }
      };
    },
    [symbolObservable](): InteropSubscribable<any> {
      return this;
    }
  };

  return store;
}
