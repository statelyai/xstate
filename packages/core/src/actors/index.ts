import { createActor } from '../Actor.ts';
import type { ActorRef, AnyEventObject, Snapshot } from '../types.ts';
import { fromTransition } from './transition.ts';
export { fromCallback, type CallbackActorLogic } from './callback.ts';
export {
  fromEventObservable,
  fromObservable,
  type ObservableActorLogic
} from './observable.ts';
export { fromPromise, type PromiseActorLogic } from './promise.ts';
export {
  fromTransition,
  type TransitionActorLogic,
  type TransitionSnapshot
} from './transition.ts';

const emptyLogic = fromTransition((_) => undefined, undefined);

export function createEmptyActor(): ActorRef<
  AnyEventObject,
  Snapshot<undefined>
> {
  return createActor(emptyLogic);
}
