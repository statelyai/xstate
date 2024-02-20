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

function deepClone(val: any) {
  return JSON.parse(JSON.stringify(val));
}

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

type Setter<T> = (context: T, recipe: (state: T) => void) => T;

type Foo<T> = {
  get: (context: T, selector?: (state: T) => any) => any;
  set: Setter<T>;
};

const defaultApi: Foo<any> = {
  get: (ctx, selector) => {
    const selected = selector?.(ctx) ?? ctx;
    return deepClone(selected);
  },
  set: (ctx, recipe) => {
    recipe(ctx);
    return ctx;
  }
};

export function createStore<
  TContext extends MachineContext,
  TEventPayloadMap extends EventPayloadMap
>(
  context: TContext,
  transitions: {
    [K in keyof TEventPayloadMap]: (
      ctx: TContext,
      ev: TEventPayloadMap[K]
    ) => void;
  },
  api: Foo<TContext> | Setter<TContext> = defaultApi
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>> {
  const get = typeof api === 'function' ? defaultApi.get : api.get;
  const set = typeof api === 'function' ? api : api.set;

  const initialCtx = get(context);
  let ctx = get(context);
  function receive(ev: ExtractEventsFromPayloadMap<TEventPayloadMap>) {
    const fn =
      transitions?.[
        ev.type as ExtractEventsFromPayloadMap<TEventPayloadMap>['type']
      ];

    ctx = set(ctx, (d) => void fn?.(d, ev as any));

    // fn?.(ctx, ev as any);
    // const cloned = deepClone(ctx);
    const cloned = get(ctx);
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
    select<TSelected>(selector: (ctx: TContext) => TSelected) {
      return get(ctx, selector);
    },
    getSnapshot() {
      return get(ctx);
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
