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

/** Adds actor capabilities without reading them until the callback does. @internal */
export function withActorScope<T extends object>(
  args: T,
  actorScope: AnyActorScope
): T &
  Pick<AnyActorScope, 'self' | 'system'> & {
    parent: AnyActor | undefined;
  } {
  if (!isLazyActorScope(actorScope)) {
    const actorArgs = args as T &
      Pick<AnyActorScope, 'self' | 'system'> & {
        parent: AnyActor | undefined;
      };
    const self = actorScope.self;
    actorArgs.self = self;
    actorArgs.system = actorScope.system;
    actorArgs.parent = self._parent;
    return actorArgs;
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
