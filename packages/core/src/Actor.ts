import {
  EventObject,
  Subscribable,
  InvokeDefinition,
  AnyEventObject,
  SCXML
} from './types';
import { StateMachine } from '.';
import { isMachine, mapContext } from './utils';

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
  machine: StateMachine<TC, any, TE>,
  context: TC,
  _event: SCXML.Event<TE>
): Actor {
  const tempActor = createNullActor(invokeDefinition.id);
  const serviceCreator = machine.options.services?.[invokeDefinition.src];
  tempActor.deferred = true;

  if (isMachine(serviceCreator)) {
    const resolvedData = invokeDefinition.data
      ? mapContext(invokeDefinition.data, context, _event)
      : undefined;
    tempActor.state = (resolvedData
      ? serviceCreator.withContext(resolvedData)
      : serviceCreator
    ).initialState;
  }

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
