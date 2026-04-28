import { createActor } from '../createActor.ts';
import type { ActorRef, AnyEventObject, Snapshot } from '../types.ts';
import { fromTransition } from './transition.ts';
export {
  createCallbackLogic,
  fromCallback,
  type CallbackActorLogic,
  type CallbackActorRef,
  type CallbackSnapshot,
  type CallbackLogicFunction
} from './callback.ts';
export {
  createObservableLogic,
  fromEventObservable,
  fromObservable,
  type ObservableActorLogic,
  type ObservableActorRef,
  type ObservableSnapshot
} from './observable.ts';
export {
  createLogic,
  type LogicActorLogic,
  type LogicActorRef,
  type LogicArgs,
  type LogicConfig,
  type LogicEffect,
  type LogicEffectState,
  type LogicEnqueue,
  type LogicFunction,
  type LogicPatch,
  type LogicSnapshot
} from './logic.ts';
export {
  createAsyncLogic,
  type AsyncActorLogic,
  type AsyncActorRef,
  type AsyncSnapshot,
  type LogicArgs as AsyncLogicArgs,
  type LogicConfig as AsyncLogicConfig,
  type LogicEnqueue as AsyncLogicEnqueue,
  type LogicFunction as AsyncLogicFunction,
  TimeoutError
} from './promise.ts';
export {
  fromTransition,
  type TransitionActorLogic,
  type TransitionActorRef,
  type TransitionSnapshot
} from './transition.ts';
export {
  createListenerLogic,
  listenerLogic,
  type ListenerActorLogic,
  type ListenerActorRef,
  type ListenerSnapshot,
  type ListenerInput
} from './listener.ts';
export {
  createSubscriptionLogic,
  subscriptionLogic,
  type SubscriptionActorLogic,
  type SubscriptionActorRef,
  type SubscriptionSnapshot,
  type SubscriptionInput,
  type SubscriptionMappers
} from './subscription.ts';

const emptyLogic = fromTransition((_) => undefined, undefined);

export function createEmptyActor(): ActorRef<
  Snapshot<undefined>,
  AnyEventObject,
  AnyEventObject
> {
  return createActor(emptyLogic);
}
