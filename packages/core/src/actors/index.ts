import { createActor } from '../createActor.ts';
import type { ActorFromLogic } from '../types.ts';
import { createStepLogic } from './logic.ts';
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
  createStepLogic,
  type StepActorLogic,
  type StepActorRef,
  type StepLogicArgs,
  type StepLogicConfig,
  type StepEffectState,
  type StepLogicEnqueue,
  type StepLogicFunction,
  type StepPatch,
  type StepSnapshot
} from './logic.ts';
export {
  createAsyncLogic,
  type AsyncActorLogic,
  type AsyncActorRef,
  type AsyncSnapshot,
  type AsyncLogicArgs,
  type AsyncLogicConfig,
  type AsyncLogicEnqueue,
  type AsyncLogicFunction,
  TimeoutError
} from './promise.ts';
export {
  createListenerLogic,
  type ListenerActorLogic,
  type ListenerActorRef,
  type ListenerSnapshot,
  type ListenerInput
} from './listener.ts';
export {
  createSubscriptionLogic,
  type SubscriptionActorLogic,
  type SubscriptionActorRef,
  type SubscriptionSnapshot,
  type SubscriptionInput,
  type SubscriptionMappers
} from './subscription.ts';

const emptyLogic = /* #__PURE__ */ createStepLogic<undefined, undefined>({
  context: undefined,
  run: () => undefined
});

/** @public */
export function createEmptyActor(): ActorFromLogic<typeof emptyLogic> {
  return createActor(emptyLogic);
}
