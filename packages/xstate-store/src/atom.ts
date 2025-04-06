import {
  createReactiveSystem,
  Dependency,
  Link,
  Subscriber,
  SubscriberFlags
} from './alien';
import { toObserver } from './toObserver';
import {
  Atom,
  AtomOptions,
  Observer,
  Readable,
  ReadonlyAtom,
  Subscribable
} from './types';

const {
  link,
  propagate,
  endTracking,
  startTracking,
  updateDirtyFlag,
  processComputedUpdate,
  processEffectNotifications
} = createReactiveSystem({
  updateComputed(computed: Computed) {
    return computed.update();
  },
  notifyEffect(effect: Effect) {
    effect.notify();
    return true;
  }
});

let activeSub: Subscriber | undefined = undefined;

export function createAtom<T>(
  getValue: (read: <U>(atom: Readable<U>) => U) => T,
  options?: AtomOptions<T>
): ReadonlyAtom<T>;
export function createAtom<T>(
  initialValue: T,
  options?: AtomOptions<T>
): Atom<T>;
export function createAtom<T>(
  valueOrFn: T | ((read: <U>(atom: Readable<U>) => U) => T),
  options?: AtomOptions<T>
): Atom<T> | ReadonlyAtom<T> {
  if (typeof valueOrFn === 'function') {
    return computed(valueOrFn as () => T, options);
  }
  return new Signal(valueOrFn, options);
}

class Signal<T = any> implements Dependency, Subscribable<T> {
  // Dependency fields
  subs: Link | undefined = undefined;
  subsTail: Link | undefined = undefined;
  observers: Set<Observer<T>> | undefined = undefined;

  constructor(
    public currentValue: T,
    public options?: AtomOptions<T>
  ) {}

  get(): T {
    if (activeSub !== undefined) {
      link(this, activeSub);
    }
    return this.currentValue;
  }

  set(valueOrFn: T | ((prev: T) => T)): void {
    const compare = this.options?.compare ?? Object.is;
    const value =
      typeof valueOrFn === 'function'
        ? (valueOrFn as (prev: T) => T)(this.currentValue)
        : valueOrFn;
    if (compare(this.currentValue, value)) return;
    this.currentValue = value;
    const subs = this.subs;
    if (subs !== undefined) {
      propagate(subs);
      processEffectNotifications();
    }
  }

  subscribe(observerOrFn: Observer<T> | ((value: T) => void)) {
    const obs = toObserver(observerOrFn);
    const observed = { current: false };
    const e = effect(() => {
      this.get();
      if (!observed.current) {
        observed.current = true;
      } else {
        obs.next?.(this.currentValue);
      }
    });

    return {
      unsubscribe: () => {
        e.stop();
      }
    };
  }
}

function computed<T>(
  getter: (read: <U>(atom: Readable<U>) => U) => T,
  options?: AtomOptions<T>
): Computed<T> {
  return new Computed<T>(getter, options);
}

class Computed<T = any> implements Subscriber, Dependency, ReadonlyAtom<T> {
  currentValue: T | undefined = undefined;

  // Dependency fields
  subs: Link | undefined = undefined;
  subsTail: Link | undefined = undefined;

  // Subscriber fields
  deps: Link | undefined = undefined;
  depsTail: Link | undefined = undefined;
  flags: SubscriberFlags = SubscriberFlags.Computed | SubscriberFlags.Dirty;
  observers: Set<Observer<T>> | undefined = undefined;

  constructor(
    public getter: (read: <U>(atom: Readable<U>) => U) => T,
    public options?: AtomOptions<T>
  ) {}

  get(): T {
    const flags = this.flags;
    if (flags & (SubscriberFlags.PendingComputed | SubscriberFlags.Dirty)) {
      processComputedUpdate(this, flags);
    }
    if (activeSub !== undefined) {
      link(this, activeSub);
    }
    return this.currentValue!;
  }

  update(): boolean {
    const prevSub = activeSub;
    const compare = this.options?.compare ?? Object.is;
    // eslint-disable-next-line
    activeSub = this;
    startTracking(this);
    try {
      const oldValue = this.currentValue;
      // TODO: deprecate this
      const read = (atom: Readable<any>) => atom.get();
      const newValue = this.getter(read);
      if (oldValue === undefined || !compare(oldValue, newValue)) {
        this.currentValue = newValue;
        return true;
      }
      return false;
    } finally {
      activeSub = prevSub;
      endTracking(this);
    }
  }
  subscribe(observerOrFn: Observer<T> | ((value: T) => void)) {
    const obs = toObserver(observerOrFn);
    const observed = { current: false };
    const e = effect(() => {
      this.get();
      if (!observed.current) {
        observed.current = true;
      } else {
        obs.next?.(this.get());
      }
    });

    return {
      unsubscribe: () => {
        e.stop();
      }
    };
  }
}

function effect<T>(fn: () => T): Effect<T> {
  const e = new Effect(fn);

  e.run();

  return e;
}

class Effect<T = any> implements Subscriber {
  // Subscriber fields
  deps: Link | undefined = undefined;
  depsTail: Link | undefined = undefined;
  flags: SubscriberFlags = SubscriberFlags.Effect;

  constructor(public fn: () => T) {}

  notify(): void {
    const flags = this.flags;
    if (
      flags & SubscriberFlags.Dirty ||
      (flags & SubscriberFlags.PendingComputed && updateDirtyFlag(this, flags))
    ) {
      this.run();
    }
  }

  run(): T {
    const prevSub = activeSub;
    // eslint-disable-next-line
    activeSub = this;
    startTracking(this);
    try {
      return this.fn();
    } finally {
      activeSub = prevSub;
      endTracking(this);
    }
  }

  stop(): void {
    startTracking(this);
    endTracking(this);
  }
}
