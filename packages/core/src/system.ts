import { fromReducer } from './actors/reducer.js';
import { interpret } from './interpreter.js';
import {
  ActorSystem,
  ActorSystemInfo,
  AnyActorRef,
  AnyEventObject
} from './types.js';

const deadLettersBehavior = fromReducer<
  any,
  {
    type: 'deadLetter';
    event: AnyEventObject;
  },
  any
>((state, event) => {
  if (event.type === 'deadLetter') {
    state.push({
      event: event.event
    });
  }

  return state;
}, []);

export function createSystem<T extends ActorSystemInfo>(): ActorSystem<T> {
  let sessionIdIndex = 0;
  const children = new Map<string, AnyActorRef>();
  const keyedActors = new Map<keyof T['actors'], AnyActorRef | undefined>();
  const reverseKeyedActors = new WeakMap<AnyActorRef, keyof T['actors']>();

  let deadLetters;

  const system: ActorSystem<T> = {
    _register: (actorRef) => {
      const id = `x:${sessionIdIndex++}`;
      children.set(id, actorRef);
      return id;
    },
    _unregister: (actorRef) => {
      children.delete(actorRef.id);
      const key = reverseKeyedActors.get(actorRef);

      if (key !== undefined) {
        keyedActors.delete(key);
        reverseKeyedActors.delete(actorRef);
      }
    },
    get: (key) => {
      return keyedActors.get(key) as T['actors'][any];
    },
    set: (key, actorRef) => {
      keyedActors.set(key, actorRef);
      reverseKeyedActors.set(actorRef, key);
    },
    get deadLetters() {
      if (!deadLetters) {
        deadLetters = interpret(deadLettersBehavior, {
          system
        }).start();
      }

      return deadLetters;
    }
  };

  return system;
}
