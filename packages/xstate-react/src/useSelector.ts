import { useEffect, useState } from 'react';
import { ActorRef, Interpreter, Subscribable } from 'xstate';
import { isActorWithState } from './useActor';
import { getServiceSnapshot } from './useService';

function isService(actor: any): actor is Interpreter<any, any, any, any> {
  return 'state' in actor && 'machine' in actor;
}

const defaultCompare = (a, b) => a === b;

export function useSelector<
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare,
  getSnapshot: (a: TActor) => TEmitted = (a) =>
    isService(a)
      ? getServiceSnapshot(a)
      : isActorWithState(a)
      ? a.state
      : undefined
) {
  const [selected, setSelected] = useState(() => selector(getSnapshot(actor)));

  useEffect(() => {
    const sub = actor.subscribe((emitted) => {
      const nextSelected = selector(emitted);
      if (!compare(selected, nextSelected)) {
        setSelected(nextSelected);
      }
    });

    return () => sub.unsubscribe();
  }, [selector]);

  return selected;
}
