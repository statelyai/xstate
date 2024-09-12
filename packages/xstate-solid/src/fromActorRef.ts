import { Accessor, createEffect, createMemo, onCleanup } from 'solid-js';
import { AnyActorRef, SnapshotFrom } from 'xstate';
import { createImmutable } from './createImmutable.ts';

const noop = () => {};

export function fromActorRef<TActor extends AnyActorRef | undefined>(
  actorRef: Accessor<TActor> | TActor
): Accessor<
  | SnapshotFrom<NonNullable<TActor>>
  | (undefined extends TActor ? undefined : never)
> {
  const actorMemo = createMemo(() =>
    typeof actorRef === 'function' ? actorRef() : actorRef
  );

  const [snapshot, setSnapshot] = createImmutable({
    v: actorMemo()?.getSnapshot()
  });

  createEffect<boolean>((isInitialActor) => {
    const currentActor = actorMemo();
    if (!isInitialActor) {
      setSnapshot({ v: currentActor?.getSnapshot() });
    }

    if (currentActor) {
      const { unsubscribe } = currentActor.subscribe({
        next: (nextSnapshot) => setSnapshot({ v: nextSnapshot }),
        error: noop,
        complete: noop
      });
      onCleanup(unsubscribe);
    }
    return false;
  }, true);

  return () => snapshot.v;
}
