import { EventObject, ActorRef, BaseActorRef } from './types';
import { symbolObservable } from './utils';

export function isActorRef(item: any): item is ActorRef<any> {
  return !!item && typeof item === 'object' && typeof item.send === 'function';
}

// TODO: refactor the return type, this could be written in a better way but it's best to avoid unneccessary breaking changes now
export function toActorRef<
  TEvent extends EventObject,
  TEmitted = any,
  TActorRefLike extends BaseActorRef<TEvent> = BaseActorRef<TEvent>
>(
  actorRefLike: TActorRefLike
): ActorRef<TEvent, TEmitted> & Omit<TActorRefLike, keyof ActorRef<any, any>> {
  return {
    subscribe: () => ({ unsubscribe: () => void 0 }),
    name: 'anonymous',
    getSnapshot: () => undefined,
    [symbolObservable]: function () {
      return this;
    },
    ...actorRefLike
  };
}
