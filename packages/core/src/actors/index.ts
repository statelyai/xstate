import { createActor } from '../createActor.ts';
import type { ActorRef, AnyEventObject, Snapshot } from '../types.ts';
import { fromTransition } from './transition.ts';
export {
  fromCallback,
  type CallbackActorLogic,
  type CallbackActorRef,
  type CallbackSnapshot
} from './callback.ts';
export {
  fromEventObservable,
  fromObservable,
  type ObservableActorLogic,
  type ObservableActorRef,
  type ObservableSnapshot
} from './observable.ts';
export {
  fromPromise,
  type PromiseActorLogic,
  type PromiseActorRef,
  type PromiseSnapshot
} from './promise.ts';
export {
  fromTransition,
  type TransitionActorLogic,
  type TransitionActorRef,
  type TransitionSnapshot
} from './transition.ts';

const emptyLogic = fromTransition((_) => undefined, undefined);

export function createEmptyActor(): ActorRef<
  Snapshot<undefined>,
  AnyEventObject,
  AnyEventObject
> {
  return createActor(emptyLogic);
}
