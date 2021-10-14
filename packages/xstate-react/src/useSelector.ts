import { useEffect, useRef, useState } from 'react';
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
  const [selected, setSelected] = useState(() => selector(getSnapshot(actor)));
  const selectedRef = useRef<T>(selected);

  const updateSelectedIfChanged = (nextSelected: T) => {
    if (!compare(selectedRef.current, nextSelected)) {
      setSelected(nextSelected);
      selectedRef.current = nextSelected;
    }
  };

  useEffect(() => {
    const sub = actor.subscribe((emitted) => {
      updateSelectedIfChanged(selector(emitted));
    });

    return () => sub.unsubscribe();
  }, [actor]);

  useEffect(() => {
    updateSelectedIfChanged(selectedRef.current);
  }, [selector, compare]);

  return selected;
}
