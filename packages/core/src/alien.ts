/* eslint-disable */
// Adapted from Alien Signals
// https://github.com/stackblitz/alien-signals/

export interface ReactiveNode {
  deps?: Link;
  depsTail?: Link;
  subs?: Link;
  subsTail?: Link;
  flags: ReactiveFlags;
}

export interface Link {
  version: number;
  dep: ReactiveNode;
  sub: ReactiveNode;
  prevSub: Link | undefined;
  nextSub: Link | undefined;
  prevDep: Link | undefined;
  nextDep: Link | undefined;
}

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export const enum ReactiveFlags {
  None = 0,
  Mutable = 1,
  Watching = 2,
  RecursedCheck = 4,
  Recursed = 8,
  Dirty = 16,
  Pending = 32
}

export function createReactiveSystem({
  update,
  notify,
  unwatched
}: {
  update(sub: ReactiveNode): boolean;
  notify(sub: ReactiveNode): void;
  unwatched(sub: ReactiveNode): void;
}) {
  return {
    link,
    unlink,
    propagate,
    checkDirty,
    shallowPropagate
  };

  function link(dep: ReactiveNode, sub: ReactiveNode, version: number): void {
    const prevDep = sub.depsTail;
    if (prevDep !== undefined && prevDep.dep === dep) {
      return;
    }
    const nextDep = prevDep !== undefined ? prevDep.nextDep : sub.deps;
    if (nextDep !== undefined && nextDep.dep === dep) {
      nextDep.version = version;
      sub.depsTail = nextDep;
      return;
    }
    const prevSub = dep.subsTail;
    if (
      prevSub !== undefined &&
      prevSub.version === version &&
      prevSub.sub === sub
    ) {
      return;
    }
    const newLink =
      (sub.depsTail =
      dep.subsTail =
        {
          version,
          dep,
          sub,
          prevDep,
          nextDep,
          prevSub,
          nextSub: undefined
        });
    if (nextDep !== undefined) {
      nextDep.prevDep = newLink;
    }
    if (prevDep !== undefined) {
      prevDep.nextDep = newLink;
    } else {
      sub.deps = newLink;
    }
    if (prevSub !== undefined) {
      prevSub.nextSub = newLink;
    } else {
      dep.subs = newLink;
    }
  }

  function unlink(link: Link, sub = link.sub): Link | undefined {
    const dep = link.dep;
    const prevDep = link.prevDep;
    const nextDep = link.nextDep;
    const nextSub = link.nextSub;
    const prevSub = link.prevSub;
    if (nextDep !== undefined) {
      nextDep.prevDep = prevDep;
    } else {
      sub.depsTail = prevDep;
    }
    if (prevDep !== undefined) {
      prevDep.nextDep = nextDep;
    } else {
      sub.deps = nextDep;
    }
    if (nextSub !== undefined) {
      nextSub.prevSub = prevSub;
    } else {
      dep.subsTail = prevSub;
    }
    if (prevSub !== undefined) {
      prevSub.nextSub = nextSub;
    } else if ((dep.subs = nextSub) === undefined) {
      unwatched(dep);
    }
    return nextDep;
  }

  function propagate(link: Link): void {
    let next = link.nextSub;
    let stack: Stack<Link | undefined> | undefined;

    top: do {
      const sub = link.sub;
      let flags = sub.flags;

      if (
        !(
          flags &
          (ReactiveFlags.RecursedCheck |
            ReactiveFlags.Recursed |
            ReactiveFlags.Dirty |
            ReactiveFlags.Pending)
        )
      ) {
        sub.flags = flags | ReactiveFlags.Pending;
      } else if (
        !(flags & (ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed))
      ) {
        flags = ReactiveFlags.None;
      } else if (!(flags & ReactiveFlags.RecursedCheck)) {
        sub.flags = (flags & ~ReactiveFlags.Recursed) | ReactiveFlags.Pending;
      } else if (
        !(flags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) &&
        isValidLink(link, sub)
      ) {
        sub.flags = flags | (ReactiveFlags.Recursed | ReactiveFlags.Pending);
        flags &= ReactiveFlags.Mutable;
      } else {
        flags = ReactiveFlags.None;
      }

      if (flags & ReactiveFlags.Watching) {
        notify(sub);
      }

      if (flags & ReactiveFlags.Mutable) {
        const subSubs = sub.subs;
        if (subSubs !== undefined) {
          const nextSub = (link = subSubs).nextSub;
          if (nextSub !== undefined) {
            stack = { value: next, prev: stack };
            next = nextSub;
          }
          continue;
        }
      }

      if ((link = next!) !== undefined) {
        next = link.nextSub;
        continue;
      }

      while (stack !== undefined) {
        link = stack.value!;
        stack = stack.prev;
        if (link !== undefined) {
          next = link.nextSub;
          continue top;
        }
      }

      break;
    } while (true);
  }

  function checkDirty(link: Link, sub: ReactiveNode): boolean {
    let stack: Stack<Link> | undefined;
    let checkDepth = 0;
    let dirty = false;

    top: do {
      const dep = link.dep;
      const flags = dep.flags;

      if (sub.flags & ReactiveFlags.Dirty) {
        dirty = true;
      } else if (
        (flags & (ReactiveFlags.Mutable | ReactiveFlags.Dirty)) ===
        (ReactiveFlags.Mutable | ReactiveFlags.Dirty)
      ) {
        if (update(dep)) {
          const subs = dep.subs!;
          if (subs.nextSub !== undefined) {
            shallowPropagate(subs);
          }
          dirty = true;
        }
      } else if (
        (flags & (ReactiveFlags.Mutable | ReactiveFlags.Pending)) ===
        (ReactiveFlags.Mutable | ReactiveFlags.Pending)
      ) {
        if (link.nextSub !== undefined || link.prevSub !== undefined) {
          stack = { value: link, prev: stack };
        }
        link = dep.deps!;
        sub = dep;
        ++checkDepth;
        continue;
      }

      if (!dirty) {
        const nextDep = link.nextDep;
        if (nextDep !== undefined) {
          link = nextDep;
          continue;
        }
      }

      while (checkDepth--) {
        const firstSub = sub.subs!;
        const hasMultipleSubs = firstSub.nextSub !== undefined;
        if (hasMultipleSubs) {
          link = stack!.value;
          stack = stack!.prev;
        } else {
          link = firstSub;
        }
        if (dirty) {
          if (update(sub)) {
            if (hasMultipleSubs) {
              shallowPropagate(firstSub);
            }
            sub = link.sub;
            continue;
          }
          dirty = false;
        } else {
          sub.flags &= ~ReactiveFlags.Pending;
        }
        sub = link.sub;
        const nextDep = link.nextDep;
        if (nextDep !== undefined) {
          link = nextDep;
          continue top;
        }
      }

      return dirty;
    } while (true);
  }

  function shallowPropagate(link: Link): void {
    do {
      const sub = link.sub;
      const flags = sub.flags;
      if (
        (flags & (ReactiveFlags.Pending | ReactiveFlags.Dirty)) ===
        ReactiveFlags.Pending
      ) {
        sub.flags = flags | ReactiveFlags.Dirty;
        if (
          (flags & (ReactiveFlags.Watching | ReactiveFlags.RecursedCheck)) ===
          ReactiveFlags.Watching
        ) {
          notify(sub);
        }
      }
    } while ((link = link.nextSub!) !== undefined);
  }

  function isValidLink(checkLink: Link, sub: ReactiveNode): boolean {
    let link = sub.depsTail;
    while (link !== undefined) {
      if (link === checkLink) {
        return true;
      }
      link = link.prevDep;
    }
    return false;
  }
}

interface EffectNode extends ReactiveNode {
  fn(): void;
}

interface ComputedNode<T = any> extends ReactiveNode {
  value: T | undefined;
  getter: (previousValue?: T) => T;
}

interface SignalNode<T = any> extends ReactiveNode {
  currentValue: T;
  pendingValue: T;
}

let cycle = 0;
let batchDepth = 0;
let notifyIndex = 0;
let queuedLength = 0;
let activeSub: ReactiveNode | undefined;

const queued: (EffectNode | undefined)[] = [];
const { link, unlink, propagate, checkDirty, shallowPropagate } =
  createReactiveSystem({
    update(node: SignalNode | ComputedNode): boolean {
      if (node.depsTail !== undefined) {
        return updateComputed(node as ComputedNode);
      } else {
        return updateSignal(node as SignalNode);
      }
    },
    notify(effect: EffectNode) {
      let insertIndex = queuedLength;
      let firstInsertedIndex = insertIndex;

      do {
        queued[insertIndex++] = effect;
        effect.flags &= ~ReactiveFlags.Watching;
        effect = effect.subs?.sub as EffectNode;
        if (effect === undefined || !(effect.flags & ReactiveFlags.Watching)) {
          break;
        }
      } while (true);

      queuedLength = insertIndex;

      while (firstInsertedIndex < --insertIndex) {
        const left = queued[firstInsertedIndex];
        queued[firstInsertedIndex++] = queued[insertIndex];
        queued[insertIndex] = left;
      }
    },
    unwatched(node) {
      if (!(node.flags & ReactiveFlags.Mutable)) {
        effectScopeOper.call(node);
      } else if (node.depsTail !== undefined) {
        node.depsTail = undefined;
        node.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
        purgeDeps(node);
      }
    }
  });

export function getActiveSub(): ReactiveNode | undefined {
  return activeSub;
}

export function setActiveSub(sub?: ReactiveNode) {
  const prevSub = activeSub;
  activeSub = sub;
  return prevSub;
}

export function getBatchDepth(): number {
  return batchDepth;
}

export function startBatch() {
  ++batchDepth;
}

export function endBatch() {
  if (!--batchDepth) {
    flush();
  }
}

export function isSignal(fn: () => void): boolean {
  return fn.name === 'bound ' + signalOper.name;
}

export function isComputed(fn: () => void): boolean {
  return fn.name === 'bound ' + computedOper.name;
}

export function isEffect(fn: () => void): boolean {
  return fn.name === 'bound ' + effectOper.name;
}

export function isEffectScope(fn: () => void): boolean {
  return fn.name === 'bound ' + effectScopeOper.name;
}

export function signal<T>(): {
  (): T | undefined;
  (value: T | undefined): void;
};
export function signal<T>(initialValue: T): {
  (): T;
  (value: T): void;
};
export function signal<T>(initialValue?: T): {
  (): T | undefined;
  (value: T | undefined): void;
} {
  return signalOper.bind({
    currentValue: initialValue,
    pendingValue: initialValue,
    subs: undefined,
    subsTail: undefined,
    flags: ReactiveFlags.Mutable
  }) as () => T | undefined;
}

export function computed<T>(getter: (previousValue?: T) => T): () => T {
  return computedOper.bind({
    value: undefined,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: ReactiveFlags.None,
    getter: getter as (previousValue?: unknown) => unknown
  }) as () => T;
}

export function effect(fn: () => void): () => void {
  const e: EffectNode = {
    fn,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: ReactiveFlags.Watching | ReactiveFlags.RecursedCheck
  };
  const prevSub = setActiveSub(e);
  if (prevSub !== undefined) {
    link(e, prevSub, 0);
  }
  try {
    e.fn();
  } finally {
    activeSub = prevSub;
    e.flags &= ~ReactiveFlags.RecursedCheck;
  }
  return effectOper.bind(e);
}

export function effectScope(fn: () => void): () => void {
  const e: ReactiveNode = {
    deps: undefined,
    depsTail: undefined,
    subs: undefined,
    subsTail: undefined,
    flags: ReactiveFlags.None
  };
  const prevSub = setActiveSub(e);
  if (prevSub !== undefined) {
    link(e, prevSub, 0);
  }
  try {
    fn();
  } finally {
    activeSub = prevSub;
  }
  return effectScopeOper.bind(e);
}

export function trigger(fn: () => void) {
  const sub: ReactiveNode = {
    deps: undefined,
    depsTail: undefined,
    flags: ReactiveFlags.Watching
  };
  const prevSub = setActiveSub(sub);
  try {
    fn();
  } finally {
    activeSub = prevSub;
    let link = sub.deps;
    while (link !== undefined) {
      const dep = link.dep;
      link = unlink(link, sub);
      const subs = dep.subs;
      if (subs !== undefined) {
        sub.flags = ReactiveFlags.None;
        propagate(subs);
        shallowPropagate(subs);
      }
    }
    if (!batchDepth) {
      flush();
    }
  }
}

function updateComputed(c: ComputedNode): boolean {
  ++cycle;
  c.depsTail = undefined;
  c.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
  const prevSub = setActiveSub(c);
  try {
    const oldValue = c.value;
    return oldValue !== (c.value = c.getter(oldValue));
  } finally {
    activeSub = prevSub;
    c.flags &= ~ReactiveFlags.RecursedCheck;
    purgeDeps(c);
  }
}

function updateSignal(s: SignalNode): boolean {
  s.flags = ReactiveFlags.Mutable;
  return s.currentValue !== (s.currentValue = s.pendingValue);
}

function run(e: EffectNode): void {
  const flags = e.flags;
  if (
    flags & ReactiveFlags.Dirty ||
    (flags & ReactiveFlags.Pending && checkDirty(e.deps!, e))
  ) {
    ++cycle;
    e.depsTail = undefined;
    e.flags = ReactiveFlags.Watching | ReactiveFlags.RecursedCheck;
    const prevSub = setActiveSub(e);
    try {
      (e as EffectNode).fn();
    } finally {
      activeSub = prevSub;
      e.flags &= ~ReactiveFlags.RecursedCheck;
      purgeDeps(e);
    }
  } else {
    e.flags = ReactiveFlags.Watching;
  }
}

function flush(): void {
  try {
    while (notifyIndex < queuedLength) {
      const effect = queued[notifyIndex]!;
      queued[notifyIndex++] = undefined;
      run(effect);
    }
  } finally {
    while (notifyIndex < queuedLength) {
      const effect = queued[notifyIndex]!;
      queued[notifyIndex++] = undefined;
      effect.flags |= ReactiveFlags.Watching | ReactiveFlags.Recursed;
    }
    notifyIndex = 0;
    queuedLength = 0;
  }
}

function computedOper<T>(this: ComputedNode<T>): T {
  const flags = this.flags;
  if (
    flags & ReactiveFlags.Dirty ||
    (flags & ReactiveFlags.Pending &&
      (checkDirty(this.deps!, this) ||
        ((this.flags = flags & ~ReactiveFlags.Pending), false)))
  ) {
    if (updateComputed(this)) {
      const subs = this.subs;
      if (subs !== undefined) {
        shallowPropagate(subs);
      }
    }
  } else if (!flags) {
    this.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
    const prevSub = setActiveSub(this);
    try {
      this.value = this.getter();
    } finally {
      activeSub = prevSub;
      this.flags &= ~ReactiveFlags.RecursedCheck;
    }
  }
  const sub = activeSub;
  if (sub !== undefined) {
    link(this, sub, cycle);
  }
  return this.value!;
}

function signalOper<T>(this: SignalNode<T>, ...value: [T]): T | void {
  if (value.length) {
    if (this.pendingValue !== (this.pendingValue = value[0])) {
      this.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
      const subs = this.subs;
      if (subs !== undefined) {
        propagate(subs);
        if (!batchDepth) {
          flush();
        }
      }
    }
  } else {
    if (this.flags & ReactiveFlags.Dirty) {
      if (updateSignal(this)) {
        const subs = this.subs;
        if (subs !== undefined) {
          shallowPropagate(subs);
        }
      }
    }
    let sub = activeSub;
    while (sub !== undefined) {
      if (sub.flags & (ReactiveFlags.Mutable | ReactiveFlags.Watching)) {
        link(this, sub, cycle);
        break;
      }
      sub = sub.subs?.sub;
    }
    return this.currentValue;
  }
}

function effectOper(this: EffectNode): void {
  effectScopeOper.call(this);
}

function effectScopeOper(this: ReactiveNode): void {
  this.depsTail = undefined;
  this.flags = ReactiveFlags.None;
  purgeDeps(this);
  const sub = this.subs;
  if (sub !== undefined) {
    unlink(sub);
  }
}

function purgeDeps(sub: ReactiveNode) {
  const depsTail = sub.depsTail;
  let dep = depsTail !== undefined ? depsTail.nextDep : sub.deps;
  while (dep !== undefined) {
    dep = unlink(dep, sub);
  }
}
