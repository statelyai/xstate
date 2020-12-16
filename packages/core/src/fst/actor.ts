import { FST } from '.';
import { ActorRef, EventObject, Observer } from '..';
import { toObserver } from '../utils';

export function toActorFST<TState, TEvent extends EventObject, TOutput = any>(
  fst: FST<TState, TEvent, TOutput>,
  handleOutput?: (output: TOutput) => void
): ActorRef<TEvent, TState> {
  let currentState = fst.initialState;
  const observers = new Set<Observer<TState>>();

  const actor: ActorRef<TEvent, TState> = {
    send: (event: TEvent) => {
      const [nextState, output] = fst.transition(currentState, event);

      currentState = nextState;
      handleOutput?.(output);

      observers.forEach((observer) => observer.next(nextState));
    },
    subscribe: (next, onError?, onComplete?) => {
      const observer = toObserver(next, onError, onComplete);

      observers.add(observer);
      observer.next(currentState);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
    }
  };

  return actor;
}
