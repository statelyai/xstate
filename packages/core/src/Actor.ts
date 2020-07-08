import {
  EventObject,
  Subscribable,
  InvokeDefinition,
  AnyEventObject,
  StateMachine,
  Spawnable
} from './types';
import { isMachine } from './utils';

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
  invokeDefinition: InvokeDefinition<TC, TE>,
  machine?: StateMachine<TC, any, TE>
): Actor {
  const serviceCreator = machine?.options.services?.[invokeDefinition.src];
  const tempActor = serviceCreator
    ? createDeferredActor(serviceCreator as Spawnable, invokeDefinition.id)
    : createNullActor(invokeDefinition.id);

  tempActor.meta = invokeDefinition;

  return tempActor;
}

export function createDeferredActor(entity: Spawnable, id: string): Actor {
  const tempActor = createNullActor(id);
  tempActor.deferred = true;

  if (isMachine(entity)) {
    tempActor.state = entity.initialState;
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
