/* eslint-disable */
// Adapted from Alien Signals
// https://github.com/stackblitz/alien-signals/

export interface ReactiveNode {
  _deps?: Link;
  _depsTail?: Link;
  _subs?: Link;
  _subsTail?: Link;
  _flags: ReactiveFlags;
}

interface Link {
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

export enum ReactiveFlags {
  None = 0,
  Mutable = 1 << 0,
  Watching = 1 << 1,
  RecursedCheck = 1 << 2,
  Recursed = 1 << 3,
  Dirty = 1 << 4,
  Pending = 1 << 5
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
  let currentVersion = 0;
  return {
    link,
    unlink,
    propagate,
    checkDirty,
    endTracking,
    startTracking,
    shallowPropagate
  };

  function link(dep: ReactiveNode, sub: ReactiveNode): void {
    const prevDep = sub._depsTail;
    if (prevDep !== undefined && prevDep.dep === dep) {
      return;
    }
    const nextDep = prevDep !== undefined ? prevDep.nextDep : sub._deps;
    if (nextDep !== undefined && nextDep.dep === dep) {
      nextDep.version = currentVersion;
      sub._depsTail = nextDep;
      return;
    }
    const prevSub = dep._subsTail;
    if (
      prevSub !== undefined &&
      prevSub.version === currentVersion &&
      prevSub.sub === sub
    ) {
      return;
    }
    const newLink =
      (sub._depsTail =
      dep._subsTail =
        {
          version: currentVersion,
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
      sub._deps = newLink;
    }
    if (prevSub !== undefined) {
      prevSub.nextSub = newLink;
    } else {
      dep._subs = newLink;
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
      sub._depsTail = prevDep;
    }
    if (prevDep !== undefined) {
      prevDep.nextDep = nextDep;
    } else {
      sub._deps = nextDep;
    }
    if (nextSub !== undefined) {
      nextSub.prevSub = prevSub;
    } else {
      dep._subsTail = prevSub;
    }
    if (prevSub !== undefined) {
      prevSub.nextSub = nextSub;
    } else if ((dep._subs = nextSub) === undefined) {
      unwatched(dep);
    }
    return nextDep;
  }

  function propagate(link: Link): void {
    let next = link.nextSub;
    let stack: Stack<Link | undefined> | undefined;

    top: do {
      const sub = link.sub;
      let flags = sub._flags;

      if (
        !(
          flags &
          (60 as
            | ReactiveFlags.RecursedCheck
            | ReactiveFlags.Recursed
            | ReactiveFlags.Dirty
            | ReactiveFlags.Pending)
        )
      ) {
        sub._flags = flags | (32 satisfies ReactiveFlags.Pending);
      } else if (
        !(flags & (12 as ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed))
      ) {
        flags = 0 satisfies ReactiveFlags.None;
      } else if (!(flags & (4 satisfies ReactiveFlags.RecursedCheck))) {
        sub._flags =
          (flags & ~(8 satisfies ReactiveFlags.Recursed)) |
          (32 satisfies ReactiveFlags.Pending);
      } else if (
        !(flags & (48 as ReactiveFlags.Dirty | ReactiveFlags.Pending)) &&
        isValidLink(link, sub)
      ) {
        sub._flags =
          flags | (40 as ReactiveFlags.Recursed | ReactiveFlags.Pending);
        flags &= 1 satisfies ReactiveFlags.Mutable;
      } else {
        flags = 0 satisfies ReactiveFlags.None;
      }

      if (flags & (2 satisfies ReactiveFlags.Watching)) {
        notify(sub);
      }

      if (flags & (1 satisfies ReactiveFlags.Mutable)) {
        const subSubs = sub._subs;
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

  function startTracking(sub: ReactiveNode): void {
    ++currentVersion;
    sub._depsTail = undefined;
    sub._flags =
      (sub._flags &
        ~(56 as
          | ReactiveFlags.Recursed
          | ReactiveFlags.Dirty
          | ReactiveFlags.Pending)) |
      (4 satisfies ReactiveFlags.RecursedCheck);
  }

  function endTracking(sub: ReactiveNode): void {
    const depsTail = sub._depsTail;
    let toRemove = depsTail !== undefined ? depsTail.nextDep : sub._deps;
    while (toRemove !== undefined) {
      toRemove = unlink(toRemove, sub);
    }
    sub._flags &= ~(4 satisfies ReactiveFlags.RecursedCheck);
  }

  function checkDirty(link: Link, sub: ReactiveNode): boolean {
    let stack: Stack<Link> | undefined;
    let checkDepth = 0;

    top: do {
      const dep = link.dep;
      const flags = dep._flags;
      let dirty = false;

      if (sub._flags & (16 satisfies ReactiveFlags.Dirty)) {
        dirty = true;
      } else if (
        (flags & (17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty)) ===
        (17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty)
      ) {
        if (update(dep)) {
          const subs = dep._subs!;
          if (subs.nextSub !== undefined) {
            shallowPropagate(subs);
          }
          dirty = true;
        }
      } else if (
        (flags & (33 as ReactiveFlags.Mutable | ReactiveFlags.Pending)) ===
        (33 as ReactiveFlags.Mutable | ReactiveFlags.Pending)
      ) {
        if (link.nextSub !== undefined || link.prevSub !== undefined) {
          stack = { value: link, prev: stack };
        }
        link = dep._deps!;
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
        const firstSub = sub._subs!;
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
        } else {
          sub._flags &= ~(32 satisfies ReactiveFlags.Pending);
        }
        sub = link.sub;
        const nextDep = link.nextDep;
        if (nextDep !== undefined) {
          link = nextDep;
          continue top;
        }
        dirty = false;
      }

      return dirty;
    } while (true);
  }

  function shallowPropagate(link: Link): void {
    do {
      const sub = link.sub;
      const flags = sub._flags;
      if (
        (flags & (48 as ReactiveFlags.Pending | ReactiveFlags.Dirty)) ===
        (32 satisfies ReactiveFlags.Pending)
      ) {
        sub._flags = flags | (16 satisfies ReactiveFlags.Dirty);
        if (flags & (2 satisfies ReactiveFlags.Watching)) {
          notify(sub);
        }
      }
    } while ((link = link.nextSub!) !== undefined);
  }

  function isValidLink(checkLink: Link, sub: ReactiveNode): boolean {
    let link = sub._depsTail;
    while (link !== undefined) {
      if (link === checkLink) {
        return true;
      }
      link = link.prevDep;
    }
    return false;
  }
}
