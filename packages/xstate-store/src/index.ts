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
  TProducer extends <T>(ctx: T, recipe: (ctx: T) => void) => T,
  TContext extends MachineContext,
  TEventPayloadMap extends EventPayloadMap
>(
  producer: TProducer,
  context: TContext,
  transitions: {
    [K in keyof TEventPayloadMap & string]: (
      ctx: NoInfer<TContext>,
      ev: { type: K } & TEventPayloadMap[K]
    ) => void;
  }
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>> {
  return createStore(context, transitions as any, (ctx, recipe) =>
    producer(ctx, recipe)
  );
}

type Assigner<TC, TE extends EventObject> = (ctx: TC, ev: TE) => Partial<TC>;
type PropertyAssigner<TC, TE extends EventObject> = {
  [K in keyof TC]?: TC[K] | ((ctx: TC, ev: TE) => Partial<TC>[K]);
};

export function createStore<
  TContext extends MachineContext,
  TEventPayloadMap extends EventPayloadMap
>(
  context: TContext,
  transitions: {
    [K in keyof TEventPayloadMap & string]:
      | Assigner<NoInfer<TContext>, { type: K } & TEventPayloadMap[K]>
      | PropertyAssigner<NoInfer<TContext>, { type: K } & TEventPayloadMap[K]>;
  },
  updater?: (
    ctx: NoInfer<TContext>,
    recipe: (ctx: NoInfer<TContext>) => NoInfer<TContext>
  ) => NoInfer<TContext>
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>> {
  const setter = updater ?? defaultSetter;
  let currentContext = context;
  function receive(ev: ExtractEventsFromPayloadMap<TEventPayloadMap>) {
    const fn =
      transitions?.[
        ev.type as ExtractEventsFromPayloadMap<TEventPayloadMap>['type']
      ];

    if (!fn) {
      return;
    }

    if (typeof fn === 'function') {
      currentContext = updater
        ? updater(currentContext, (d) => fn?.(d, ev as any))
        : setter(currentContext, (d) =>
            Object.assign({}, currentContext, fn?.(d, ev as any))
          );
    } else {
      const partialUpdate: Record<string, unknown> = {};
      for (const key of Object.keys(fn)) {
        const propAssignment = fn[key];
        partialUpdate[key] =
          typeof propAssignment === 'function'
            ? propAssignment(currentContext, ev as any)
            : propAssignment;
      }
      currentContext = Object.assign({}, currentContext, partialUpdate);
    }

    observers?.forEach((o) => o.next?.(currentContext));
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
      return currentContext;
    },
    getInitialSnapshot() {
      return context;
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
