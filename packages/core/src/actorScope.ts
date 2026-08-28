import type { AnyActor, AnyActorScope } from './types.ts';

/** Marks the internal lazy scope without imposing structure on custom runtimes. @internal */
export const lazyActorScope = Symbol();

type InternalActorScope = AnyActorScope & {
  _parent?: AnyActor;
  [lazyActorScope]?: true;
};

/** Whether actor capabilities are represented by a lazy pure-transition scope. @internal */
export function isLazyActorScope(actorScope: AnyActorScope): boolean {
  return !!(actorScope as InternalActorScope)[lazyActorScope];
}

/** Reads parent metadata without otherwise touching actor capabilities. @internal */
export function getActorScopeParent(
  actorScope: AnyActorScope
): AnyActor | undefined {
  return isLazyActorScope(actorScope)
    ? (actorScope as InternalActorScope)._parent
    : actorScope.self._parent;
}

/** Adds only `self`, preserving callback surfaces that expose no other capabilities. @internal */
export function withActorSelf<T extends object>(
  args: T,
  actorScope: AnyActorScope
): T & Pick<AnyActorScope, 'self'> {
  if (!isLazyActorScope(actorScope)) {
    return Object.assign(args, { self: actorScope.self });
  }
  Object.defineProperty(args, 'self', {
    enumerable: true,
    get: () => actorScope.self
  });
  return args as T & Pick<AnyActorScope, 'self'>;
}

/** Adds the actor reference and parent without exposing the system. @internal */
export function withActorSelfAndParent<T extends object>(
  args: T,
  actorScope: AnyActorScope
): T & Pick<AnyActorScope, 'self'> & { parent: AnyActor | undefined } {
  if (!isLazyActorScope(actorScope)) {
    const self = actorScope.self;
    return Object.assign(args, { self, parent: self._parent });
  }
  Object.defineProperties(args, {
    self: { enumerable: true, get: () => actorScope.self },
    parent: { enumerable: true, get: () => getActorScopeParent(actorScope) }
  });
  return args as T &
    Pick<AnyActorScope, 'self'> & { parent: AnyActor | undefined };
}

/** Adds actor capabilities without reading them until the callback does. @internal */
export function withActorScope<T extends object>(
  args: T,
  actorScope: AnyActorScope
): T &
  Pick<AnyActorScope, 'self' | 'system'> & {
    parent: AnyActor | undefined;
  } {
  if (!isLazyActorScope(actorScope)) {
    const self = actorScope.self;
    return Object.assign(args, {
      self,
      system: actorScope.system,
      parent: self._parent
    });
  }
  Object.defineProperties(args, {
    self: { enumerable: true, get: () => actorScope.self },
    system: { enumerable: true, get: () => actorScope.system },
    parent: { enumerable: true, get: () => getActorScopeParent(actorScope) }
  });
  return args as T &
    Pick<AnyActorScope, 'self' | 'system'> & {
      parent: AnyActor | undefined;
    };
}
