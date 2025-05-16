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
    let nextDep: Link | undefined = undefined;
    const recursedCheck =
      sub._flags & (4 satisfies ReactiveFlags.RecursedCheck);
    if (recursedCheck) {
      nextDep = prevDep !== undefined ? prevDep.nextDep : sub._deps;
      if (nextDep !== undefined && nextDep.dep === dep) {
        sub._depsTail = nextDep;
        return;
      }
    }
    const prevSub = dep._subsTail;
    if (
      prevSub !== undefined &&
      prevSub.sub === sub &&
      (!recursedCheck || isValidLink(prevSub, sub))
    ) {
      return;
    }
    const newLink =
      (sub._depsTail =
      dep._subsTail =
        {
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

      if (flags & (3 as ReactiveFlags.Mutable | ReactiveFlags.Watching)) {
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
          !(
            flags & (12 as ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed)
          )
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
            link = subSubs;
            if (subSubs.nextSub !== undefined) {
              stack = { value: next, prev: stack };
              next = link.nextSub;
            }
            continue;
          }
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
      const depFlags = dep._flags;

      let dirty = false;

      if (sub._flags & (16 satisfies ReactiveFlags.Dirty)) {
        dirty = true;
      } else if (
        (depFlags & (17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty)) ===
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
        (depFlags & (33 as ReactiveFlags.Mutable | ReactiveFlags.Pending)) ===
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

      if (!dirty && link.nextDep !== undefined) {
        link = link.nextDep;
        continue;
      }

      while (checkDepth) {
        --checkDepth;
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
        if (link.nextDep !== undefined) {
          link = link.nextDep;
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
      const nextSub = link.nextSub;
      const subFlags = sub._flags;
      if (
        (subFlags & (48 as ReactiveFlags.Pending | ReactiveFlags.Dirty)) ===
        (32 satisfies ReactiveFlags.Pending)
      ) {
        sub._flags = subFlags | (16 satisfies ReactiveFlags.Dirty);
        if (subFlags & (2 satisfies ReactiveFlags.Watching)) {
          notify(sub);
        }
      }
      link = nextSub!;
    } while (link !== undefined);
  }

  function isValidLink(checkLink: Link, sub: ReactiveNode): boolean {
    const depsTail = sub._depsTail;
    if (depsTail !== undefined) {
      let link = sub._deps!;
      do {
        if (link === checkLink) {
          return true;
        }
        if (link === depsTail) {
          break;
        }
        link = link.nextDep!;
      } while (link !== undefined);
    }
    return false;
  }
}
