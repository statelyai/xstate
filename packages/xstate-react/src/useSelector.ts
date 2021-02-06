import { useEffect, useState } from 'react';
import { ActorRef, Interpreter, Subscribable } from 'xstate';
import { isActorWithState } from './useActor';
import { getServiceSnapshot } from './useService';

export function useSelector<
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = (a, b) => a === b,
  getSnapshot: (a: TActor) => TEmitted = (a) =>
    a instanceof Interpreter
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
  });

  return selected;
}
