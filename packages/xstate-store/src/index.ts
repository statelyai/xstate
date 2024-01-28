import {
  toObserver,
  type EventObject,
  type InteropObservable,
  type Observer,
  type Subscribable
} from 'xstate';

type Sender<Ev extends EventObject> = ((ev: Ev) => void) & {
  [K in Ev['type']]: (payload: Omit<Ev & { type: K }, 'type'>) => void;
};

function deepClone(val: any) {
  return JSON.parse(JSON.stringify(val));
}

interface Store<T, Ev extends EventObject>
  extends Subscribable<T>,
    InteropObservable<T> {
  send: Sender<Ev>;
  getSnapshot: () => T;
  getInitialSnapshot: () => T;
}

export function createStore<T, Ev extends EventObject>(
  context: T,
  transitions?: {
    [K in Ev['type']]: (ctx: T, ev: Ev) => void;
  }
): Store<T, Ev> {
  const initialCtx = deepClone(context);
  let ctx = deepClone(context);
  function receive(ev: Ev) {
    const fn = transitions?.[ev.type as Ev['type']];

    fn?.(ctx, ev);
    const cloned = deepClone(ctx);
    observers?.forEach((o) => o.next?.(cloned));
  }
  let observers: Set<Observer<any>> | undefined;

  const o: Store<T, Ev> = {
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
    }
  };

  if (transitions) {
    for (const [key, fn] of Object.entries(transitions)) {
      // o[key] = (ev: Ev) => fn(ctx, ev);
      // @ts-ignore
      o.send[key] = (ev) => receive({ ...ev, type: key });
    }
  }

  return o;
}
