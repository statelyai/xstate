import type { EventObject, ActorRef, BaseActorRef } from '../types.js';
import { symbolObservable } from '../symbolObservable.js';
import { ActorStatus } from '../interpreter.js';
export { fromTransition } from './transition.js';
export { fromPromise } from './promise.js';
export { fromObservable, fromEventObservable } from './observable.js';
export { fromCallback } from './callback.js';

export const startSignalType = 'xstate.init';
export const stopSignalType = 'xstate.stop';
export const startSignal: StartSignal = { type: 'xstate.init' };
export const stopSignal: StopSignal = { type: 'xstate.stop' };

export interface StartSignal {
  type: 'xstate.init';
}

export interface StopSignal {
  type: 'xstate.stop';
}

export type LifecycleSignal = StartSignal | StopSignal;
export type LifecycleSignalType =
  | typeof startSignalType
  | typeof stopSignalType;

/**
 * An object that expresses the behavior of an actor in reaction to received events,
 * as well as an optionally emitted stream of values.
 *
 * @template TReceived The received event
 * @template TSnapshot The emitted value
 */

export function isSignal(eventType: string): eventType is LifecycleSignalType {
  return eventType === startSignalType || eventType === stopSignalType;
}

export function isActorRef(item: any): item is ActorRef<any> {
  return !!item && typeof item === 'object' && typeof item.send === 'function';
}

// TODO: refactor the return type, this could be written in a better way
// but it's best to avoid unneccessary breaking changes now
// @deprecated use `interpret(behavior)` instead
export function toActorRef<
  TEvent extends EventObject,
  TSnapshot = any,
  TActorRefLike extends BaseActorRef<TEvent> = BaseActorRef<TEvent>
>(
  actorRefLike: TActorRefLike
): ActorRef<TEvent, TSnapshot> & Omit<TActorRefLike, keyof ActorRef<any, any>> {
  return {
    subscribe: () => ({ unsubscribe: () => void 0 }),
    id: 'anonymous',
    sessionId: '',
    getSnapshot: () => undefined,
    [symbolObservable]: function () {
      return this;
    },
    status: ActorStatus.Running,
    stop: () => void 0,
    ...actorRefLike
  };
}
