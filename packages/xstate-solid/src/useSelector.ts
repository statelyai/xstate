import type { ActorRef, Subscribable } from 'xstate';
import { defaultGetSnapshot } from './useActor';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, on, onCleanup } from 'solid-js';
import { deepClone } from './utils';
import { createStoreSignal } from './createStoreSignal';

const defaultCompare = (a, b) => a === b;

export function useSelector<
  TActor extends ActorRef<any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: Accessor<TActor>,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare,
  getSnapshot: (a: TActor) => TEmitted = defaultGetSnapshot
): Accessor<T> {
  const actorMemo = createMemo<TActor>(actor);
  const getActorSnapshot = (snapshotActor: TActor): T =>
    deepClone(selector(getSnapshot(snapshotActor)));
  const [selected, update] = createStoreSignal<T, T>(
    actorMemo,
    getActorSnapshot
  );

  const guardedUpdate = (nextSelected: TEmitted) => {
    if (!compare(selected(), selector(nextSelected))) {
      update(selector(nextSelected));
    }
  };

  createEffect(
    on(
      () => [actorMemo, getActorSnapshot(actorMemo())],
      () => {
        guardedUpdate(getSnapshot(actorMemo()));
        const { unsubscribe } = actorMemo().subscribe((emitted) => {
          guardedUpdate(emitted);
        });
        onCleanup(() => {
          unsubscribe();
        });
      }
    )
  );

  return selected;
}
