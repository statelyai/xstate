import {
  EventObject,
  Subscribable,
  InvokeDefinition,
  AnyEventObject
} from './types';

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
}

export function createNullActor<TContext, TEvent extends EventObject>(
  id: string
): Actor<TContext, TEvent> {
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
 * Creates a null actor that is able to be invoked given the provided
 * invocation information in its `.meta` value.
 *
 * @param invokeDefinition The meta information needed to invoke the actor.
 */
export function createInvocableActor<TContext, TEvent extends EventObject>(
  invokeDefinition: InvokeDefinition<TContext, TEvent>
): Actor<any, TEvent> {
  const tempActor = createNullActor<TContext, TEvent>(invokeDefinition.id);

  tempActor.meta = invokeDefinition;

  return tempActor;
}

export function isActor(item: any): item is Actor {
  try {
    return typeof item.send === 'function';
  } catch (e) {
    return false;
  }
}
