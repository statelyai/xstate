import {
  EventObject,
  AssignAction,
  SCXML,
  AssignMeta,
  ActionObject
} from './types';
import { IS_PRODUCTION } from './environment';
import { State } from '.';
import { ActorRef } from './Actor';
import { warn, isFunction, keys } from './utils';

export function updateContext<TContext, TEvent extends EventObject>(
  context: TContext,
  _event: SCXML.Event<TEvent>,
  assignActions: Array<AssignAction<TContext, TEvent>>,
  state?: State<TContext, TEvent>,
  service?: ActorRef<any, TEvent>
): [TContext, ActionObject<TContext, TEvent>[]] {
  if (!IS_PRODUCTION) {
    warn(!!context, 'Attempting to update undefined context');
  }
  const capturedActions: ActionObject<TContext, TEvent>[] = [];

  const updatedContext = context
    ? assignActions.reduce((acc, assignAction) => {
        const { assignment } = assignAction as AssignAction<TContext, TEvent>;
        const meta: AssignMeta<TContext, TEvent> = {
          state,
          action: assignAction,
          _event,
          self: service,
          spawn: (actorRef, name) => {
            capturedActions.push({
              type: 'xstate.spawnStart',
              actorRef,
              name
            });

            return actorRef;
          }
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
