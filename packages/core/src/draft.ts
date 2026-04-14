/**
 * Minimal copy-on-write drafter for plain objects and arrays.
 *
 * Used to let transition / entry / exit functions mutate `context` directly
 * while still producing a new immutable context object that preserves
 * referential equality for unchanged subtrees.
 *
 * This is intentionally narrow: only plain objects and arrays are drafted.
 * Anything else (class instances, Map, Set, ActorRef, etc.) is returned by
 * reference. ActorRefs are detected by the same shape-sniff used by
 * `persistContext` in `State.ts`.
 */

const STATE = Symbol.for('xstate.draftState');

interface DraftState {
  base: any;
  copy: any | null;
  modified: boolean;
  proxies: Map<PropertyKey, any>;
  parent: DraftState | null;
}

function isActorRefLike(value: any): boolean {
  return (
    'sessionId' in value &&
    'send' in value &&
    'ref' in value &&
    typeof value.send === 'function'
  );
}

function isDraftable(value: unknown): value is object {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return true;
  if (isActorRefLike(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function latest(state: DraftState): any {
  return state.modified ? state.copy : state.base;
}

function markChanged(state: DraftState): void {
  if (state.modified) return;
  state.modified = true;
  state.copy = Array.isArray(state.base)
    ? state.base.slice()
    : { ...state.base };
  if (state.parent) markChanged(state.parent);
}

function unwrap(value: any): any {
  const inner = value?.[STATE] as DraftState | undefined;
  return inner ? finalize(inner) : value;
}

const handler: ProxyHandler<DraftState> = {
  get(state, prop) {
    if (prop === STATE) return state;
    const target = latest(state);
    const value = target[prop as any];
    if (!isDraftable(value)) return value;
    let childProxy = state.proxies.get(prop);
    if (childProxy !== undefined) return childProxy;
    const childState: DraftState = {
      base: value,
      copy: null,
      modified: false,
      proxies: new Map(),
      parent: state
    };
    childProxy = new Proxy(childState as any, handler as any);
    state.proxies.set(prop, childProxy);
    return childProxy;
  },
  set(state, prop, value) {
    // Short-circuit no-op writes to avoid spurious copies
    const current = latest(state)[prop as any];
    const incoming = unwrap(value);
    if (
      Object.is(current, incoming) &&
      (state.modified || prop in state.base)
    ) {
      return true;
    }
    markChanged(state);
    state.copy[prop as any] = incoming;
    state.proxies.delete(prop);
    return true;
  },
  deleteProperty(state, prop) {
    if (!(prop in latest(state))) return true;
    markChanged(state);
    delete state.copy[prop as any];
    state.proxies.delete(prop);
    return true;
  },
  has(state, prop) {
    return prop in latest(state);
  },
  ownKeys(state) {
    return Reflect.ownKeys(latest(state));
  },
  getOwnPropertyDescriptor(state, prop) {
    const target = latest(state);
    const desc = Object.getOwnPropertyDescriptor(target, prop);
    if (desc) {
      desc.configurable = true;
      desc.writable = true;
    }
    return desc;
  },
  getPrototypeOf(state) {
    return Object.getPrototypeOf(state.base);
  },
  defineProperty() {
    throw new Error('defineProperty is not supported on a context draft');
  },
  setPrototypeOf() {
    throw new Error('setPrototypeOf is not supported on a context draft');
  }
};

function finalize(state: DraftState): any {
  if (state.modified) {
    for (const [key, childProxy] of state.proxies) {
      const childState = childProxy[STATE] as DraftState;
      const childResult = finalize(childState);
      if (!Object.is(state.copy[key as any], childResult)) {
        state.copy[key as any] = childResult;
      }
    }
    return state.copy;
  }

  let result: any = state.base;
  for (const [key, childProxy] of state.proxies) {
    const childState = childProxy[STATE] as DraftState;
    const childResult = finalize(childState);
    if (!Object.is(state.base[key as any], childResult)) {
      if (result === state.base) {
        result = Array.isArray(state.base)
          ? state.base.slice()
          : { ...state.base };
      }
      result[key as any] = childResult;
    }
  }
  if (result !== state.base) {
    state.modified = true;
    state.copy = result;
  }
  return result;
}

export interface Draft<T> {
  draft: T;
  /**
   * Returns the finalized object if the draft (or any nested branch) was
   * mutated, otherwise returns `undefined`.
   */
  finish(): T | undefined;
}

/**
 * Recursively replaces any draft proxies inside a plain object/array with their
 * finalized base values. Used for the case where a transition function builds
 * an explicit `res.context` by spreading the draft (which yields nested draft
 * proxies for draftable values).
 *
 * Non-draftable values, ActorRefs, and class instances are returned as-is.
 */
export function unwrapDrafts<T>(value: T, seen?: WeakMap<object, any>): T {
  if (value === null || typeof value !== 'object') return value;
  if (isActorRefLike(value)) return value;
  const inner = (value as any)[STATE] as DraftState | undefined;
  if (inner) return finalize(inner) as T;

  const proto = Object.getPrototypeOf(value);
  const isPlainObj = proto === Object.prototype || proto === null;
  if (!isPlainObj && !Array.isArray(value)) return value;

  seen ??= new WeakMap();
  if (seen.has(value as object)) return seen.get(value as object) as T;

  if (Array.isArray(value)) {
    let arrCopy: any[] | undefined;
    for (let i = 0; i < value.length; i++) {
      const unwrapped = unwrapDrafts(value[i], seen);
      if (!Object.is(unwrapped, value[i])) {
        arrCopy = arrCopy ?? value.slice();
        arrCopy![i] = unwrapped;
      }
    }
    const result = (arrCopy ?? value) as T;
    seen.set(value as object, result);
    return result;
  }

  let objCopy: Record<string, any> | undefined;
  for (const key of Object.keys(value as object)) {
    const v = (value as any)[key];
    const unwrapped = unwrapDrafts(v, seen);
    if (!Object.is(unwrapped, v)) {
      objCopy = objCopy ?? { ...(value as any) };
      objCopy![key] = unwrapped;
    }
  }
  const result = (objCopy ?? value) as T;
  seen.set(value as object, result);
  return result;
}

/**
 * Creates a draft of a plain object or array. The draft can be mutated freely;
 * a finalized copy is produced lazily on `finish()`. Unmutated subtrees are
 * shared by reference with the original.
 *
 * Non-draftable inputs (class instances, ActorRefs, primitives) are returned
 * as-is and `finish()` always returns `undefined`.
 */
export function createDraft<T>(base: T): Draft<T> {
  if (!isDraftable(base)) {
    return {
      draft: base,
      finish: () => undefined
    };
  }
  const state: DraftState = {
    base,
    copy: null,
    modified: false,
    proxies: new Map(),
    parent: null
  };
  const proxy = new Proxy(state as any, handler as any) as T;
  return {
    draft: proxy,
    finish: () => {
      const result = finalize(state);
      return state.modified ? (result as T) : undefined;
    }
  };
}
