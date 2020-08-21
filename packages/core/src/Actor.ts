import {
  EventObject,
  Subscribable,
  InvokeDefinition,
  AnyEventObject,
  StateMachine,
  Spawnable,
  SCXML
} from './types';
import { isMachine, mapContext, toInvokeSource } from './utils';

export interface Actor<
  TContext = any,
  TEvent extends EventObject = AnyEventObject
> extends Subscribable<TContext> {
  id: string;
  send: (event: TEvent) => any; // TODO: change to void
  stop?: () => any | undefined;
  toJSON: () => {
    id: string;
  };
  meta?: InvokeDefinition<TContext, TEvent>;
  state?: any;
  deferred?: boolean;
}

export function createNullActor(id: string): Actor {
  return {
    id,
    send: () => void 0,
    subscribe: () => ({
      unsubscribe: () => void 0
    }),
    toJSON: () => ({
      id
    })
  };
}

/**
 * Creates a deferred actor that is able to be invoked given the provided
 * invocation information in its `.meta` value.
 *
 * @param invokeDefinition The meta information needed to invoke the actor.
 */
export function createInvocableActor<TC, TE extends EventObject>(
  isInitial: Boolean,
  invokeDefinition: InvokeDefinition<TC, TE>,
  machine: StateMachine<TC, any, TE>,
  context: TC,
  _event: SCXML.Event<TE>
): Actor {
  const invokeSrc = toInvokeSource(invokeDefinition.src);
  const serviceCreator = machine?.options.services?.[invokeSrc.type];
  const resolvedData = invokeDefinition.data
    ? mapContext(invokeDefinition.data, context, _event)
    : undefined;
  const tempActor = serviceCreator
    ? createDeferredActor(
        isInitial,
        serviceCreator as Spawnable,
        invokeDefinition.id,
        resolvedData
      )
    : createNullActor(invokeDefinition.id);

  tempActor.meta = invokeDefinition;

  return tempActor;
}

export function createDeferredActor(
  isInitial: Boolean,
  entity: Spawnable,
  id: string,
  data?: any
): Actor {
  const tempActor = createNullActor(id);
  tempActor.deferred = true;

  if (!isInitial && isMachine(entity)) {
    tempActor.state = (data ? entity.withContext(data) : entity).initialState;
  }

  return tempActor;
}

export function isActor(item: any): item is Actor {
  try {
    return typeof item.send === 'function';
  } catch (e) {
    return false;
  }
}
