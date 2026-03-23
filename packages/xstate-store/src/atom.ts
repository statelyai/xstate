import {
  createReactiveSystem,
  type ReactiveNode,
  ReactiveFlags
} from './alien';
import { toObserver } from './toObserver';
import {
  Atom,
  AtomOptions,
  Observer,
  Readable,
  ReadonlyAtom,
  Subscription
} from './types';

interface InternalAtom<T> extends ReactiveNode {
  _snapshot: T;
  _update(getValue?: T | ((snapshot: T) => T)): boolean;
  get(): T;
  subscribe(observerOrFn: Observer<T> | ((value: T) => void)): Subscription;
}

const queuedEffects: (Effect | undefined)[] = [];
let cycle = 0;
const { link, unlink, propagate, checkDirty, shallowPropagate } =
  createReactiveSystem({
    update(atom: InternalAtom<any>): boolean {
      return atom._update();
    },
    notify(effect: Effect): void {
      queuedEffects[queuedEffectsLength++] = effect;
      effect.flags &= ~ReactiveFlags.Watching;
    },
    unwatched(atom: InternalAtom<any>): void {
      if (atom.depsTail !== undefined) {
        atom.depsTail = undefined;
        atom.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
        purgeDeps(atom);
      }
    }
  });

let notifyIndex = 0;
let queuedEffectsLength = 0;
let activeSub: ReactiveNode | undefined;

function purgeDeps(sub: ReactiveNode) {
  const depsTail = sub.depsTail;
  let dep = depsTail !== undefined ? depsTail.nextDep : sub.deps;
  while (dep !== undefined) {
    dep = unlink(dep, sub);
  }
}

function flush(): void {
  while (notifyIndex < queuedEffectsLength) {
    const effect = queuedEffects[notifyIndex]!;
    queuedEffects[notifyIndex++] = undefined;
    effect.notify();
  }
  notifyIndex = 0;
  queuedEffectsLength = 0;
}

type AsyncAtomState<Data, Error = unknown> =
  | { status: 'pending' }
  | { status: 'done'; data: Data }
  | { status: 'error'; error: Error };

export function createAsyncAtom<T>(
  getValue: () => Promise<T>,
  options?: AtomOptions<AsyncAtomState<T>>
): ReadonlyAtom<AsyncAtomState<T>> {
  const ref: { current?: InternalAtom<AsyncAtomState<T>> } = {};
  const atom = createAtom<AsyncAtomState<T>>(() => {
    getValue().then(
      (data) => {
        const internalAtom = ref.current!;
        if (internalAtom._update({ status: 'done', data })) {
          const subs = internalAtom.subs;
          if (subs !== undefined) {
            propagate(subs);
            shallowPropagate(subs);
            flush();
          }
        }
      },
      (error) => {
        const internalAtom = ref.current!;
        if (internalAtom._update({ status: 'error', error })) {
          const subs = internalAtom.subs;
          if (subs !== undefined) {
            propagate(subs);
            shallowPropagate(subs);
            flush();
          }
        }
      }
    );

    return { status: 'pending' };
  }, options);
  ref.current = atom as unknown as InternalAtom<AsyncAtomState<T>>;

  return atom;
}

export function createAtom<T>(
  getValue: (read: <U>(atom: Readable<U>) => U, prev?: NoInfer<T>) => T,
  options?: AtomOptions<T>
): ReadonlyAtom<T>;
export function createAtom<T>(
  initialValue: T,
  options?: AtomOptions<T>
): Atom<T>;
export function createAtom<T>(
  valueOrFn: T | ((read: <U>(atom: Readable<U>) => U, prev?: T) => T),
  options?: AtomOptions<T>
): Atom<T> | ReadonlyAtom<T> {
  const isComputed = typeof valueOrFn === 'function';
  const getter = valueOrFn as (
    read: <U>(atom: Readable<U>) => U,
    prev?: T
  ) => T;

  // Create plain object atom
  const atom: InternalAtom<T> = {
    _snapshot: isComputed ? undefined! : valueOrFn,

    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: isComputed ? ReactiveFlags.None : ReactiveFlags.Mutable,

    get(): T {
      if (activeSub !== undefined) {
        link(atom, activeSub, cycle);
      }
      return atom._snapshot;
    },

    subscribe(observerOrFn: Observer<T> | ((value: T) => void)) {
      const obs = toObserver(observerOrFn);
      const observed = { current: false };
      const e = effect(() => {
        atom.get();
        if (!observed.current) {
          observed.current = true;
        } else {
          obs.next?.(atom._snapshot);
        }
      });

      return {
        unsubscribe: () => {
          e.stop();
        }
      };
    },
    _update(getValue?: T | ((snapshot: T) => T)): boolean {
      const prevSub = activeSub;
      const compare = options?.compare ?? Object.is;
      activeSub = atom;
      ++cycle;
      atom.depsTail = undefined;
      if (isComputed) {
        atom.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
      }
      try {
        const oldValue = atom._snapshot;
        const read = (a: Readable<any>) => a.get();
        const newValue =
          typeof getValue === 'function'
            ? (getValue as (snapshot: T) => T)(oldValue)
            : getValue === undefined && isComputed
              ? getter(read, oldValue)
              : getValue!;
        if (oldValue === undefined || !compare(oldValue, newValue)) {
          atom._snapshot = newValue;
          return true;
        }
        return false;
      } finally {
        activeSub = prevSub;
        if (isComputed) {
          atom.flags &= ~ReactiveFlags.RecursedCheck;
        }
        purgeDeps(atom);
      }
    }
  };

  if (isComputed) {
    atom.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
    atom.get = function (): T {
      const flags = atom.flags;
      if (
        flags & ReactiveFlags.Dirty ||
        (flags & ReactiveFlags.Pending && checkDirty(atom.deps!, atom))
      ) {
        if (atom._update()) {
          const subs = atom.subs;
          if (subs !== undefined) {
            shallowPropagate(subs);
          }
        }
      } else if (flags & ReactiveFlags.Pending) {
        atom.flags = flags & ~ReactiveFlags.Pending;
      }
      if (activeSub !== undefined) {
        link(atom, activeSub, cycle);
      }
      return atom._snapshot;
    };
  } else {
    (atom as unknown as Atom<T>).set = function (
      valueOrFn: T | ((prev: T) => T)
    ): void {
      if (atom._update(valueOrFn)) {
        const subs = atom.subs;
        if (subs !== undefined) {
          propagate(subs);
          shallowPropagate(subs);
          flush();
        }
      }
    };
  }

  return atom as unknown as Atom<T> | ReadonlyAtom<T>;
}

interface Effect extends ReactiveNode {
  notify(): void;
  stop(): void;
}

function effect<T>(fn: () => T): Effect {
  const run = (): T => {
    const prevSub = activeSub;
    activeSub = effectObj;
    ++cycle;
    effectObj.depsTail = undefined;
    effectObj.flags = ReactiveFlags.Watching | ReactiveFlags.RecursedCheck;
    try {
      return fn();
    } finally {
      activeSub = prevSub;
      effectObj.flags &= ~ReactiveFlags.RecursedCheck;
      purgeDeps(effectObj);
    }
  };
  const effectObj: Effect = {
    deps: undefined,
    depsTail: undefined,
    subs: undefined,
    subsTail: undefined,
    flags: ReactiveFlags.Watching | ReactiveFlags.RecursedCheck,

    notify(): void {
      const flags = this.flags;
      if (
        flags & ReactiveFlags.Dirty ||
        (flags & ReactiveFlags.Pending && checkDirty(this.deps!, this))
      ) {
        run();
      } else {
        this.flags = ReactiveFlags.Watching;
      }
    },

    stop(): void {
      this.flags = ReactiveFlags.None;
      this.depsTail = undefined;
      purgeDeps(this);
    }
  };

  run();

  return effectObj;
}
