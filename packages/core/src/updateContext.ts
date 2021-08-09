import {
  EventObject,
  SCXML,
  AssignMeta,
  InvokeActionObject,
  MachineContext,
  DynamicAssignAction
} from './types';
import { BaseActionObject, State } from '.';
import { isFunction, keys } from './utils';

import * as capturedState from './capturedState';

export function updateContext<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  context: TContext,
  _event: SCXML.Event<TEvent>,
  assignActions: Array<DynamicAssignAction<TContext, TEvent>>,
  state?: State<TContext, TEvent>
): [TContext, BaseActionObject[]] {
  const capturedActions: InvokeActionObject[] = [];

  if (!context) {
    throw new Error(
      'Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.'
    );
  }

  const updatedContext = context
    ? assignActions.reduce((acc, assignAction) => {
        const { assignment } = assignAction.params;

        const meta: AssignMeta<TContext, TEvent> = {
          state,
          action: assignAction,
          _event
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

        capturedActions.push(...capturedState.flushSpawns());

        return Object.assign({}, acc, partialUpdate);
      }, context)
    : context;

  return [updatedContext, capturedActions];
}
