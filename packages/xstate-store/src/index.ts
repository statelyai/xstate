import {
  Compute,
  InteropSubscribable,
  Values,
  toObserver,
  type InteropObservable,
  type Observer,
  type Subscribable
} from 'xstate';
import { symbolObservable } from '../../core/src/symbolObservable';

function deepClone(val: any) {
  return JSON.parse(JSON.stringify(val));
}

interface Store<T, Ev extends EventPayloadMap>
  extends Subscribable<T>,
    InteropObservable<T> {
  send: (event: Compute<Foo<Ev>>) => void;
  getSnapshot: () => T;
  getInitialSnapshot: () => T;
}

type EventPayloadMap = Record<string, {}>;

type Foo<T extends EventPayloadMap> = Values<{
  [K in keyof T & string]: T[K] & { type: K };
}>;

export function createStore<T, TEventPayloadMap extends EventPayloadMap>(
  context: T,
  transitions?: {
    [K in keyof TEventPayloadMap]: (ctx: T, ev: TEventPayloadMap[K]) => void;
  }
): Store<T, TEventPayloadMap> & {
  [K in keyof TEventPayloadMap]: (
    payload: Compute<Omit<TEventPayloadMap[K], 'type'>>
  ) => void;
} {
  const initialCtx = deepClone(context);
  let ctx = deepClone(context);
  function receive(ev: Foo<TEventPayloadMap>) {
    const fn = transitions?.[ev.type as Foo<TEventPayloadMap>['type']];

    fn?.(ctx, ev as any);
    const cloned = deepClone(ctx);
    observers?.forEach((o) => o.next?.(cloned));
  }
  let observers: Set<Observer<any>> | undefined;

  const o: Store<T, Foo<TEventPayloadMap>> = {
    // @ts-ignore
    send(ev: Ev) {
      receive(ev);
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

  if (transitions) {
    for (const key of Object.keys(transitions)) {
      o[key] = (ev) => receive({ ...ev, type: key });
    }
  }

  return o as any;
}
