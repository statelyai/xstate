import { createStoreTransition } from './store.ts';
import {
  EmitsFromStoreConfig,
  EventPayloadMap,
  ExtractEvents,
  StoreConfig,
  StoreContext,
  StoreLogic,
  StoreSnapshot
} from './types.ts';

export function storeConfigToLogic<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap
>(
  storeConfig: StoreConfig<TContext, TEventPayloadMap, TEmittedPayloadMap>
): StoreLogic<
  StoreSnapshot<TContext>,
  ExtractEvents<TEventPayloadMap>,
  EmitsFromStoreConfig<any>
> {
  return {
    getInitialSnapshot: () => ({
      status: 'active',
      context: storeConfig.context,
      output: undefined,
      error: undefined
    }),
    transition: createStoreTransition(storeConfig.on)
  };
}
