import type { AnyActorRef } from './types.ts';

type ActorReadHook = (actorRef: AnyActorRef) => void;

/**
 * Reactivity interop between actors and atoms.
 *
 * `Actor#get()` calls this hook (when installed) so that computed atoms can
 * track actor reads as dependencies. The hook is installed by `atom.ts` on
 * module evaluation, which only happens when atoms are actually used — apps
 * that never import atoms don't bundle the reactive system.
 */
export let onActorRead: ActorReadHook | undefined;

export function installActorReadHook(hook: ActorReadHook): void {
  onActorRead = hook;
}
