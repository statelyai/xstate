import { EventObject, AssignAction, SCXML, AssignMeta } from './types';
import { IS_PRODUCTION } from './environment';
import { State, Actor } from '.';
import { warn, isFunction, keys, isString } from './utils';
import { createNullActor } from './Actor';
import { spawnFrom, createInvocationId } from './invoke';

export function updateContext<TContext, TEvent extends EventObject>(
  context: TContext,
  _event: SCXML.Event<TEvent>,
  assignActions: Array<AssignAction<TContext, TEvent>>,
  state?: State<TContext, TEvent>
): [TContext, Record<string, Actor>] {
  if (!IS_PRODUCTION) {
    warn(!!context, 'Attempting to update undefined context');
  }

  const actorMap: Record<string, Actor> = {};

  const updatedContext = context
    ? assignActions.reduce((acc, assignAction) => {
        const { assignment } = assignAction as AssignAction<TContext, TEvent>;
        const meta: AssignMeta<TContext, TEvent> = {
          state,
          action: assignAction,
          _event,
          spawn(s, nameOrOptions) {
            const id = isString(nameOrOptions)
              ? nameOrOptions
              : createInvocationId();
            const actor = createNullActor(id);

            const invokeCreator = spawnFrom(s, actor.id);

            actor.meta = {
              src: invokeCreator,
              id: actor.id
            };
            actorMap[actor.id] = actor;

            return actor;
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
  return [updatedContext, actorMap];
}
