import { createActor } from '../createActor.ts';
import type { ActorFromLogic } from '../types.ts';
import { createLogic } from './logic.ts';
export {
  createCallbackLogic,
  type CallbackActorLogic,
  type CallbackActorRef,
  type CallbackLogicConfig,
  type CallbackSnapshot,
  type CallbackLogicFunction
} from './callback.ts';
export {
  createObservableLogic,
  createEventObservableLogic,
  type EventObservableLogicConfig,
  type EventObservableLogicFunction,
  type ObservableActorLogic,
  type ObservableActorRef,
  type ObservableLogicConfig,
  type ObservableLogicFunction,
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

const emptyLogic = /* #__PURE__ */ createLogic<undefined, undefined>({
  context: undefined,
  run: () => undefined
});

export function createEmptyActor(): ActorFromLogic<typeof emptyLogic> {
  return createActor(emptyLogic);
}
