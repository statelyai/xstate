import { createActor } from '../interpreter.ts';
import type { ActorRef, AnyEventObject } from '../types.ts';
import { fromTransition } from './transition.ts';
export { fromCallback, type CallbackActorLogic } from './callback.ts';
export {
  fromEventObservable,
  fromObservable,
  type ObservableActorLogic
} from './observable.ts';
export { fromPromise, type PromiseActorLogic } from './promise.ts';
export { fromTransition, type TransitionActorLogic } from './transition.ts';

const emptyLogic = fromTransition((_) => undefined, undefined);

export function createEmptyActor(): ActorRef<AnyEventObject, undefined> {
  return createActor(emptyLogic);
}
