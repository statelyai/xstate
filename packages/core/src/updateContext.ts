import {
  EventObject,
  AssignAction,
  SCXML,
  AssignMeta,
  ActionObject,
  InvokeActionObject,
  ActionTypes,
  Spawnable
} from './types';
import { IS_PRODUCTION } from './environment';
import { State } from '.';
import { ActorRef, BehaviorActorRef } from './Actor';
import { warn, isFunction, keys } from './utils';
import { createBehaviorFrom } from './behavior';

export function updateContext<TContext, TEvent extends EventObject>(
  context: TContext,
  _event: SCXML.Event<TEvent>,
  assignActions: Array<AssignAction<TContext, TEvent>>,
  state?: State<TContext, TEvent>,
  service?: ActorRef<TEvent>
): [TContext, ActionObject<TContext, TEvent>[]] {
  if (!IS_PRODUCTION) {
    warn(!!context, 'Attempting to update undefined context');
  }
  const capturedActions: InvokeActionObject[] = [];

  const updatedContext = context
    ? assignActions.reduce((acc, assignAction) => {
        const { assignment } = assignAction as AssignAction<TContext, TEvent>;

        const spawner = (behavior, name) => {
          const actorRef = new BehaviorActorRef(behavior, name);

          capturedActions.push({
            type: ActionTypes.Start,
            src: actorRef,
            id: name
          });

          return actorRef;
        };

        spawner.from = (entity: Spawnable, name?: string) => {
          const behavior = createBehaviorFrom(entity, service);

          return spawner(behavior, name);
        };

        const meta: AssignMeta<TContext, TEvent> = {
          state,
          action: assignAction,
          _event,
          self: service,
          spawn: spawner
        };

        let partialUpdate: Partial<TContext> = {};
        if (isFunction(assignment)) {
          partialUpdate = assignment(acc, _event.data, meta);
        } else {
          for (const key of keys(assignment)) {
            const propAssignment = assignment[key];
            partialUpdate[key] = isFunction(propAssignment)
              ? propAssignment(acc, _event.data, meta)
              : propAssignment;
          }
        }
        return Object.assign({}, acc, partialUpdate);
      }, context)
    : context;

  return [updatedContext, capturedActions];
}
