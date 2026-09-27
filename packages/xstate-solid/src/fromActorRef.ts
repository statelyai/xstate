import {
  Accessor,
  createEffect,
  createMemo,
  onCleanup,
  untrack
} from 'solid-js';
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

  createEffect(() => {
    const currentActor = actorMemo();

    untrack(() => {
      if (currentActor) {
        const { unsubscribe } = currentActor.subscribe({
          next: (nextSnapshot) => setSnapshot({ v: nextSnapshot }),
          error: () => setSnapshot({ v: currentActor.getSnapshot() }),
          complete: noop
        });
        onCleanup(unsubscribe);
      }
      setSnapshot({ v: currentActor?.getSnapshot() });
    });
  });

  return () => snapshot.v;
}
