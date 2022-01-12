import type { ActorRef, Subscribable } from 'xstate';
import {
  defaultGetSnapshot,
  getSnapshotValue,
  setSnapshotValue
} from './useActor';
import type { Accessor } from 'solid-js';
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { deepClone, updateState } from './utils';

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
  const [state, setState] = createStore(
    setSnapshotValue(actorMemo, getActorSnapshot)
  );
  const [selected, setSelected] = createSignal<T>(getSnapshotValue(state));

  const update = (nextSelected: TEmitted) => {
    if (!compare(getSnapshotValue(state), selector(nextSelected))) {
      updateState(
        setSnapshotValue(selector(nextSelected), getActorSnapshot),
        setState
      );
      setSelected(getSnapshotValue(state));
    }
  };

  createEffect(
    on(
      () => [actorMemo, getActorSnapshot(actorMemo())],
      () => {
        update(getSnapshot(actorMemo()));
        const { unsubscribe } = actorMemo().subscribe((emitted) => {
          update(emitted);
        });
        onCleanup(() => {
          unsubscribe();
        });
      }
    )
  );

  return selected;
}
