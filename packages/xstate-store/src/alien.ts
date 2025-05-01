// Adapted from Alien Signals
// https://github.com/stackblitz/alien-signals/

export interface Dependency {
  _subs: Link | undefined;
  _subsTail: Link | undefined;
}

export interface Subscriber {
  _flags: SubscriberFlags;
  _deps: Link | undefined;
  _depsTail: Link | undefined;
}

interface Link {
  dep: Dependency | (Dependency & Subscriber);
  sub: Subscriber | (Dependency & Subscriber);
  prevSub: Link | undefined;
  nextSub: Link | undefined;
  nextDep: Link | undefined;
}

interface OneWayLink<T> {
  target: T;
  linked: OneWayLink<T> | undefined;
}

export const SubscriberFlagsComputed = 1 << 0;
export const SubscriberFlagsEffect = 1 << 1;
const SubscriberFlagsTracking = 1 << 2;
const SubscriberFlagsNotified = 1 << 3;
const SubscriberFlagsRecursed = 1 << 4;
export const SubscriberFlagsDirty = 1 << 5;
export const SubscriberFlagsPendingComputed = 1 << 6;
const SubscriberFlagsPendingEffect = 1 << 7;
const SubscriberFlagsPropagated =
  SubscriberFlagsDirty |
  SubscriberFlagsPendingComputed |
  SubscriberFlagsPendingEffect;

type SubscriberFlags = number;

export function createReactiveSystem({
  updateComputed,
  notifyEffect
}: {
  /**
   * Updates the computed subscriber's value and returns whether it changed.
   *
   * This function should be called when a computed subscriber is marked as
   * Dirty. The computed subscriber's getter function is invoked, and its value
   * is updated. If the value changes, the new value is stored, and the function
   * returns `true`.
   *
   * @param computed - The computed subscriber to update.
   * @returns `true` if the computed subscriber's value changed; otherwise
   *   `false`.
   */
  updateComputed(computed: Dependency & Subscriber): boolean;
  /**
   * Handles effect notifications by processing the specified `effect`.
   *
   * When an `effect` first receives any of the following flags:
   *
   * - `Dirty`
   * - `PendingComputed`
   * - `PendingEffect` this method will process them and return `true` if the
   *   flags are successfully handled. If not fully handled, future changes to
   *   these flags will trigger additional calls until the method eventually
   *   returns `true`.
   */
  notifyEffect(effect: Subscriber): boolean;
}) {
  const notifyBuffer: (Subscriber | undefined)[] = [];

  let notifyIndex = 0;
  let notifyBufferLength = 0;

  return [
    link,
    propagate,
    updateDirtyFlag,
    startTracking,
    endTracking,
    processEffectNotifications,
    processComputedUpdate,
    processPendingInnerEffects
  ] as const;

  /**
   * Links a given dependency and subscriber if they are not already linked.
   *
   * @param dep - The dependency to be linked.
   * @param sub - The subscriber that depends on this dependency.
   * @returns The newly created link object if the two are not already linked;
   *   otherwise `undefined`.
   */
  function link(dep: Dependency, sub: Subscriber): Link | undefined {
    const currentDep = sub._depsTail;
    if (currentDep?.dep === dep) {
      return;
    }
    const nextDep = currentDep !== undefined ? currentDep.nextDep : sub._deps;
    if (nextDep?.dep === dep) {
      sub._depsTail = nextDep;
      return;
    }
    const depLastSub = dep._subsTail;
    if (depLastSub?.sub === sub && isValidLink(depLastSub, sub)) {
      return;
    }
    return linkNewDep(dep, sub, nextDep, currentDep);
  }

  /**
   * Traverses and marks subscribers starting from the provided link.
   *
   * It sets flags (e.g., Dirty, PendingComputed, PendingEffect) on each
   * subscriber to indicate which ones require re-computation or effect
   * processing. This function should be called after a signal's value changes.
   *
   * @param current - The starting link from which propagation begins.
   */
  function propagate(current: Link): void {
    let next = current.nextSub;
    let branchs: OneWayLink<Link | undefined> | undefined;
    let branchDepth = 0;
    let targetFlag = SubscriberFlagsDirty;

    top: do {
      const sub = current.sub;
      const subFlags = sub._flags;

      let shouldNotify = false;

      if (
        !(
          subFlags &
          (SubscriberFlagsTracking |
            SubscriberFlagsRecursed |
            SubscriberFlagsPropagated)
        )
      ) {
        sub._flags = subFlags | targetFlag | SubscriberFlagsNotified;
        shouldNotify = true;
      } else if (
        subFlags & SubscriberFlagsRecursed &&
        !(subFlags & SubscriberFlagsTracking)
      ) {
        sub._flags =
          (subFlags & ~SubscriberFlagsRecursed) |
          targetFlag |
          SubscriberFlagsNotified;
        shouldNotify = true;
      } else if (
        !(subFlags & SubscriberFlagsPropagated) &&
        isValidLink(current, sub)
      ) {
        sub._flags =
          subFlags |
          SubscriberFlagsRecursed |
          targetFlag |
          SubscriberFlagsNotified;
        shouldNotify = (sub as Dependency)._subs !== undefined;
      }

      if (shouldNotify) {
        const subSubs = (sub as Dependency)._subs;
        if (subSubs !== undefined) {
          current = subSubs;
          if (subSubs.nextSub !== undefined) {
            branchs = { target: next, linked: branchs };
            ++branchDepth;
            next = current.nextSub;
            targetFlag = SubscriberFlagsPendingComputed;
          } else {
            targetFlag =
              subFlags & SubscriberFlagsEffect
                ? SubscriberFlagsPendingEffect
                : SubscriberFlagsPendingComputed;
          }
          continue;
        }
        if (subFlags & SubscriberFlagsEffect) {
          notifyBuffer[notifyBufferLength++] = sub;
        }
      } else if (!(subFlags & (SubscriberFlagsTracking | targetFlag))) {
        sub._flags = subFlags | targetFlag | SubscriberFlagsNotified;
        if (
          (subFlags & (SubscriberFlagsEffect | SubscriberFlagsNotified)) ===
          SubscriberFlagsEffect
        ) {
          notifyBuffer[notifyBufferLength++] = sub;
        }
      } else if (
        !(subFlags & targetFlag) &&
        subFlags & SubscriberFlagsPropagated &&
        isValidLink(current, sub)
      ) {
        sub._flags = subFlags | targetFlag;
      }

      if ((current = next!) !== undefined) {
        next = current.nextSub;
        targetFlag = branchDepth
          ? SubscriberFlagsPendingComputed
          : SubscriberFlagsDirty;
        continue;
      }

      while (branchDepth--) {
        current = branchs!.target!;
        branchs = branchs!.linked;
        if (current !== undefined) {
          next = current.nextSub;
          targetFlag = branchDepth
            ? SubscriberFlagsPendingComputed
            : SubscriberFlagsDirty;
          continue top;
        }
      }

      break;
      // eslint-disable-next-line
    } while (true);
  }

  /**
   * Prepares the given subscriber to track new dependencies.
   *
   * It resets the subscriber's internal pointers (e.g., depsTail) and sets its
   * flags to indicate it is now tracking dependency links.
   *
   * @param sub - The subscriber to start tracking.
   */
  function startTracking(sub: Subscriber): void {
    sub._depsTail = undefined;
    sub._flags =
      (sub._flags &
        ~(
          SubscriberFlagsNotified |
          SubscriberFlagsRecursed |
          SubscriberFlagsPropagated
        )) |
      SubscriberFlagsTracking;
  }

  /**
   * Concludes tracking of dependencies for the specified subscriber.
   *
   * It clears or unlinks any tracked dependency information, then updates the
   * subscriber's flags to indicate tracking is complete.
   *
   * @param sub - The subscriber whose tracking is ending.
   */
  function endTracking(sub: Subscriber): void {
    const depsTail = sub._depsTail;
    if (depsTail !== undefined) {
      const nextDep = depsTail.nextDep;
      if (nextDep !== undefined) {
        clearTracking(nextDep);
        depsTail.nextDep = undefined;
      }
    } else if (sub._deps !== undefined) {
      clearTracking(sub._deps);
      sub._deps = undefined;
    }
    sub._flags &= ~SubscriberFlagsTracking;
  }

  /**
   * Updates the dirty flag for the given subscriber based on its dependencies.
   *
   * If the subscriber has any pending computeds, this function sets the Dirty
   * flag and returns `true`. Otherwise, it clears the PendingComputed flag and
   * returns `false`.
   *
   * @param sub - The subscriber to update.
   * @param flags - The current flag set for this subscriber.
   * @returns `true` if the subscriber is marked as Dirty; otherwise `false`.
   */
  function updateDirtyFlag(sub: Subscriber, flags: SubscriberFlags): boolean {
    if (checkDirty(sub._deps!)) {
      sub._flags = flags | SubscriberFlagsDirty;
      return true;
    } else {
      sub._flags = flags & ~SubscriberFlagsPendingComputed;
      return false;
    }
  }

  /**
   * Updates the computed subscriber if necessary before its value is accessed.
   *
   * If the subscriber is marked Dirty or PendingComputed, this function runs
   * the provided updateComputed logic and triggers a shallowPropagate for any
   * downstream subscribers if an actual update occurs.
   *
   * @param computed - The computed subscriber to update.
   * @param flags - The current flag set for this subscriber.
   */
  function processComputedUpdate(
    computed: Dependency & Subscriber,
    flags: SubscriberFlags
  ): void {
    if (flags & SubscriberFlagsDirty || checkDirty(computed._deps!)) {
      if (updateComputed(computed)) {
        const subs = computed._subs;
        if (subs !== undefined) {
          shallowPropagate(subs);
        }
      }
    } else {
      computed._flags = flags & ~SubscriberFlagsPendingComputed;
    }
  }

  /**
   * Ensures all pending internal effects for the given subscriber are
   * processed.
   *
   * This should be called after an effect decides not to re-run itself but may
   * still have dependencies flagged with PendingEffect. If the subscriber is
   * flagged with PendingEffect, this function clears that flag and invokes
   * `notifyEffect` on any related dependencies marked as Effect and Propagated,
   * processing pending effects.
   *
   * @param sub - The subscriber which may have pending effects.
   * @param flags - The current flags on the subscriber to check.
   */
  function processPendingInnerEffects(
    sub: Subscriber,
    flags: SubscriberFlags
  ): void {
    if (flags & SubscriberFlagsPendingEffect) {
      sub._flags = flags & ~SubscriberFlagsPendingEffect;
      let link = sub._deps!;
      do {
        const dep = link.dep;
        if (
          '_flags' in dep &&
          dep._flags & SubscriberFlagsEffect &&
          dep._flags & SubscriberFlagsPropagated
        ) {
          notifyEffect(dep);
        }
        link = link.nextDep!;
      } while (link !== undefined);
    }
  }

  /**
   * Processes queued effect notifications after a batch operation finishes.
   *
   * Iterates through all queued effects, calling notifyEffect on each. If an
   * effect remains partially handled, its flags are updated, and future
   * notifications may be triggered until fully handled.
   */
  function processEffectNotifications(): void {
    while (notifyIndex < notifyBufferLength) {
      const effect = notifyBuffer[notifyIndex]!;
      notifyBuffer[notifyIndex++] = undefined;
      if (!notifyEffect(effect)) {
        effect._flags &= ~SubscriberFlagsNotified;
      }
    }
    notifyIndex = 0;
    notifyBufferLength = 0;
  }

  /**
   * Creates and attaches a new link between the given dependency and
   * subscriber.
   *
   * Reuses a link object from the linkPool if available. The newly formed link
   * is added to both the dependency's linked list and the subscriber's linked
   * list.
   *
   * @param dep - The dependency to link.
   * @param sub - The subscriber to be attached to this dependency.
   * @param nextDep - The next link in the subscriber's chain.
   * @param depsTail - The current tail link in the subscriber's chain.
   * @returns The newly created link object.
   */
  function linkNewDep(
    dep: Dependency,
    sub: Subscriber,
    nextDep: Link | undefined,
    depsTail: Link | undefined
  ): Link {
    const newLink: Link = {
      dep,
      sub,
      nextDep,
      prevSub: undefined,
      nextSub: undefined
    };
    if (depsTail === undefined) {
      sub._deps = newLink;
    } else {
      depsTail.nextDep = newLink;
    }
    if (dep._subs === undefined) {
      dep._subs = newLink;
    } else {
      const oldTail = dep._subsTail!;
      newLink.prevSub = oldTail;
      oldTail.nextSub = newLink;
    }
    sub._depsTail = newLink;
    dep._subsTail = newLink;
    return newLink;
  }

  /**
   * Recursively checks and updates all computed subscribers marked as pending.
   *
   * It traverses the linked structure using a stack mechanism. For each
   * computed subscriber in a pending state, updateComputed is called and
   * shallowPropagate is triggered if a value changes. Returns whether any
   * updates occurred.
   *
   * @param current - The starting link representing a sequence of pending
   *   computeds.
   * @returns `true` if a computed was updated, otherwise `false`.
   */
  function checkDirty(current: Link): boolean {
    let prevLinks: OneWayLink<Link> | undefined;
    let checkDepth = 0;
    let dirty: boolean;

    top: do {
      dirty = false;
      const dep = current.dep;

      if (current.sub._flags & SubscriberFlagsDirty) {
        dirty = true;
      } else if ('_flags' in dep) {
        const depFlags = dep._flags;
        if (
          (depFlags & (SubscriberFlagsComputed | SubscriberFlagsDirty)) ===
          (SubscriberFlagsComputed | SubscriberFlagsDirty)
        ) {
          if (updateComputed(dep)) {
            const subs = dep._subs!;
            if (subs.nextSub !== undefined) {
              shallowPropagate(subs);
            }
            dirty = true;
          }
        } else if (
          (depFlags &
            (SubscriberFlagsComputed | SubscriberFlagsPendingComputed)) ===
          (SubscriberFlagsComputed | SubscriberFlagsPendingComputed)
        ) {
          if (current.nextSub !== undefined || current.prevSub !== undefined) {
            prevLinks = { target: current, linked: prevLinks };
          }
          current = dep._deps!;
          ++checkDepth;
          continue;
        }
      }

      if (!dirty && current.nextDep !== undefined) {
        current = current.nextDep;
        continue;
      }

      while (checkDepth) {
        --checkDepth;
        const sub = current.sub as Dependency & Subscriber;
        const firstSub = sub._subs!;
        if (dirty) {
          if (updateComputed(sub)) {
            if (firstSub.nextSub !== undefined) {
              current = prevLinks!.target;
              prevLinks = prevLinks!.linked;
              shallowPropagate(firstSub);
            } else {
              current = firstSub;
            }
            continue;
          }
        } else {
          sub._flags &= ~SubscriberFlagsPendingComputed;
        }
        if (firstSub.nextSub !== undefined) {
          current = prevLinks!.target;
          prevLinks = prevLinks!.linked;
        } else {
          current = firstSub;
        }
        if (current.nextDep !== undefined) {
          current = current.nextDep;
          continue top;
        }
        dirty = false;
      }

      return dirty;
      // eslint-disable-next-line
    } while (true);
  }

  /**
   * Quickly propagates PendingComputed status to Dirty for each subscriber in
   * the chain.
   *
   * If the subscriber is also marked as an effect, it is added to the
   * queuedEffects list for later processing.
   *
   * @param link - The head of the linked list to process.
   */
  function shallowPropagate(link: Link): void {
    do {
      const sub = link.sub;
      const subFlags = sub._flags;
      if (
        (subFlags & (SubscriberFlagsPendingComputed | SubscriberFlagsDirty)) ===
        SubscriberFlagsPendingComputed
      ) {
        sub._flags = subFlags | SubscriberFlagsDirty | SubscriberFlagsNotified;
        if (
          (subFlags & (SubscriberFlagsEffect | SubscriberFlagsNotified)) ===
          SubscriberFlagsEffect
        ) {
          notifyBuffer[notifyBufferLength++] = sub;
        }
      }
      link = link.nextSub!;
    } while (link !== undefined);
  }

  /**
   * Verifies whether the given link is valid for the specified subscriber.
   *
   * It iterates through the subscriber's link list (from sub.deps to
   * sub.depsTail) to determine if the provided link object is part of that
   * chain.
   *
   * @param checkLink - The link object to validate.
   * @param sub - The subscriber whose link list is being checked.
   * @returns `true` if the link is found in the subscriber's list; otherwise
   *   `false`.
   */
  function isValidLink(checkLink: Link, sub: Subscriber): boolean {
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

  /**
   * Clears dependency-subscription relationships starting at the given link.
   *
   * Detaches the link from both the dependency and subscriber, then continues
   * to the next link in the chain. The link objects are returned to linkPool
   * for reuse.
   *
   * @param link - The head of a linked chain to be cleared.
   */
  function clearTracking(link: Link): void {
    do {
      const dep = link.dep;
      const nextDep = link.nextDep;
      const nextSub = link.nextSub;
      const prevSub = link.prevSub;

      if (nextSub !== undefined) {
        nextSub.prevSub = prevSub;
      } else {
        dep._subsTail = prevSub;
      }

      if (prevSub !== undefined) {
        prevSub.nextSub = nextSub;
      } else {
        dep._subs = nextSub;
      }

      if (dep._subs === undefined && '_deps' in dep) {
        const depFlags = dep._flags;
        if (!(depFlags & SubscriberFlagsDirty)) {
          dep._flags = depFlags | SubscriberFlagsDirty;
        }
        const depDeps = dep._deps;
        if (depDeps !== undefined) {
          link = depDeps;
          dep._depsTail!.nextDep = nextDep;
          dep._deps = undefined;
          dep._depsTail = undefined;
          continue;
        }
      }
      link = nextDep!;
    } while (link !== undefined);
  }
}

interface EffectScope extends Subscriber {
  isScope: true;
}

interface Effect extends Subscriber, Dependency {
  fn(): void;
}

interface Computed<T = any> extends Signal<T | undefined>, Subscriber {
  getter: (previousValue?: T) => T;
}

interface Signal<T = any> extends Dependency {
  currentValue: T;
}

const [
  ,
  ,
  updateDirtyFlag,
  startTracking,
  endTracking,
  ,
  ,
  processPendingInnerEffects
] = createReactiveSystem({
  updateComputed(computed: Computed): boolean {
    const prevSub = activeSub;
    activeSub = computed;
    startTracking(computed);
    try {
      const oldValue = computed.currentValue;
      const newValue = computed.getter(oldValue);
      if (oldValue !== newValue) {
        computed.currentValue = newValue;
        return true;
      }
      return false;
    } finally {
      activeSub = prevSub;
      endTracking(computed);
    }
  },
  notifyEffect(e: Effect | EffectScope) {
    if ('isScope' in e) {
      return notifyEffectScope(e);
    } else {
      return notifyEffect(e);
    }
  }
});

let activeSub: Subscriber | undefined;

function notifyEffect(e: Effect): boolean {
  const flags = e._flags;
  if (
    flags & SubscriberFlagsDirty ||
    (flags & SubscriberFlagsPendingComputed && updateDirtyFlag(e, flags))
  ) {
    const prevSub = activeSub;
    activeSub = e;
    startTracking(e);
    try {
      e.fn();
    } finally {
      activeSub = prevSub;
      endTracking(e);
    }
  } else {
    processPendingInnerEffects(e, e._flags);
  }
  return true;
}

function notifyEffectScope(e: EffectScope): boolean {
  const flags = e._flags;
  if (flags & SubscriberFlagsPendingEffect) {
    processPendingInnerEffects(e, e._flags);
    return true;
  }
  return false;
}
