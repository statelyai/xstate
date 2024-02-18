import type {
  EventObject,
  InteropSubscribable,
  MachineContext,
  Values,
  InteropObservable,
  Observer,
  Subscribable
} from 'xstate';
import { symbolObservable } from '../../core/src/symbolObservable';

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

interface Store<T, Ev extends EventObject>
  extends Subscribable<T>,
    InteropObservable<T> {
  send: (event: Ev) => void;
  getSnapshot: () => T;
  getInitialSnapshot: () => T;
  select: <TSelected>(selector: (ctx: T) => TSelected) => TSelected;
}

type EventPayloadMap = Record<string, {}>;

type ExtractEventsFromPayloadMap<T extends EventPayloadMap> = Values<{
  [K in keyof T & string]: T[K] & { type: K };
}>;

export function createStore<
  TContext extends MachineContext,
  TEventPayloadMap extends EventPayloadMap
>(
  context: TContext,
  transitions?: {
    [K in keyof TEventPayloadMap]: (
      ctx: TContext,
      ev: TEventPayloadMap[K]
    ) => void;
  }
): Store<TContext, ExtractEventsFromPayloadMap<TEventPayloadMap>> {
  // & {
  //   [K in keyof TEventPayloadMap]: (
  //     payload: Compute<Omit<TEventPayloadMap[K], 'type'>>
  //   ) => void;
  // }
  const initialCtx = deepClone(context);
  let ctx = deepClone(context);
  function receive(ev: ExtractEventsFromPayloadMap<TEventPayloadMap>) {
    const fn =
      transitions?.[
        ev.type as ExtractEventsFromPayloadMap<TEventPayloadMap>['type']
      ];

    fn?.(ctx, ev as any);
    const cloned = deepClone(ctx);
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
      const selected = selector(ctx);
      return deepClone(selected);
    },
    getSnapshot() {
      return deepClone(ctx);
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

  // if (transitions) {
  //   for (const key of Object.keys(transitions)) {
  //     o[key] = (ev) => receive({ ...ev, type: key });
  //   }
  // }

  return store;
}
