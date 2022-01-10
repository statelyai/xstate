import type { ActorRef, Subscribable } from 'xstate';
import { defaultGetSnapshot } from './useActor';
import type { Accessor } from 'solid-js';
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';

const defaultCompare = (a, b) => a === b;

export function useSelector<
  TActor extends ActorRef<any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare,
  getSnapshot: (a: TActor) => TEmitted = defaultGetSnapshot
): Accessor<T> {
  const [selected, setSelected] = createSignal(selector(getSnapshot(actor)));

  const updateSelectedIfChanged = (nextSelected: T) => {
    if (!compare(selected(), nextSelected)) {
      setSelected(() => nextSelected);
    }
  };
  createEffect(() => {
    updateSelectedIfChanged(selector(getSnapshot(actor)));
  });
  let sub;
  onMount(() => {
    updateSelectedIfChanged(selector(getSnapshot(actor)));
    sub = actor.subscribe((emitted) => {
      updateSelectedIfChanged(selector(emitted));
    });
  });

  onCleanup(() => {
    sub?.unsubscribe();
  });

  return selected;
}
