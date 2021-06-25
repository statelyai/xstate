import { onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { ActorRef, Interpreter, Subscribable } from 'xstate';
import { isActorWithState } from './useActor';
import { getServiceSnapshot } from './useService';

function isService(actor: any): actor is Interpreter<any, any, any, any> {
  return 'state' in actor && 'machine' in actor;
}

const defaultCompare = (a, b) => a === b;
const defaultGetSnapshot = (a) =>
  isService(a)
    ? getServiceSnapshot(a)
    : isActorWithState(a)
    ? a.state
    : undefined;

export function useSelector<
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare,
  getSnapshot: (a: TActor) => TEmitted = defaultGetSnapshot
) {
  const selected = shallowRef(selector(getSnapshot(actor)));

  const updateSelectedIfChanged = (nextSelected: T) => {
    if (!compare(selected.value, nextSelected)) {
      selected.value = nextSelected;
    }
  };

  let sub;
  onMounted(() => {
    const initialSelected = selector(getSnapshot(actor));
    updateSelectedIfChanged(initialSelected);
    sub = actor.subscribe((emitted) => {
      const nextSelected = selector(emitted);
      updateSelectedIfChanged(nextSelected);
    });
  });

  onBeforeUnmount(() => {
    sub?.unsubscribe();
  });

  return selected;
}
