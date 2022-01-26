import {
  EventObject,
  Assigner,
  PropertyAssigner,
  MachineContext,
  AssignActionObject,
  DynamicAssignAction,
  AssignMeta,
  InvokeActionObject,
  ActionTypes,
  Behavior,
  ActorRef
} from '../types';
import * as actionTypes from '../actionTypes';
import { createDynamicAction } from '../../actions/dynamicAction';
import { isFunction, isString, keys } from '../utils';

import * as capturedState from '../capturedState';
import { ObservableActorRef } from '../ObservableActorRef';
import { StateMachine } from '../StateMachine';
import { SCXML } from '..';

export function createSpawner<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  machine: StateMachine<any, any>,
  context: TContext,
  _event: SCXML.Event<TEvent>,
  capturedActions: InvokeActionObject[]
): <TReceived extends EventObject, TEmitted>(
  behavior: string | Behavior<TReceived, TEmitted>,
  name?: string | undefined
) => ActorRef<TReceived, TEmitted> {
  return (behavior, name) => {
    if (isString(behavior)) {
      const behaviorCreator = machine.options.actors[behavior];

      if (behaviorCreator) {
        const resolvedName = name ?? 'anon';
        const createdBehavior = behaviorCreator(context, _event.data, {
          id: name || 'anon',
          src: { type: behavior },
          _event,
          meta: undefined
        });

        const actorRef = new ObservableActorRef(createdBehavior, resolvedName);

        capturedActions.push({
          type: ActionTypes.Invoke,
          params: {
            src: actorRef,
            ref: actorRef,
            id: actorRef.name,
            meta: undefined
          }
        });

        return actorRef;
      }

      throw new Error('does not exist');
    } else {
      const actorRef = new ObservableActorRef(behavior, name || 'anonymous');

      capturedActions.push({
        type: ActionTypes.Invoke,
        params: {
          src: actorRef,
          ref: actorRef,
          id: actorRef.name,
          meta: undefined
        }
      });

      return actorRef;
    }
  };
}

/**
 * Updates the current context of the machine.
 *
 * @param assignment An object that represents the partial context to update.
 */
export function assign<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject,
  TAssignment extends
    | Assigner<TContext, TEvent>
    | PropertyAssigner<TContext, TEvent> =
    | Assigner<TContext, TEvent>
    | PropertyAssigner<TContext, TEvent>
>(assignment: TAssignment): DynamicAssignAction<TContext, TEvent> {
  return createDynamicAction<
    TContext,
    TEvent,
    AssignActionObject<TContext>,
    {
      assignment: TAssignment;
    }
  >(
    actionTypes.assign,
    {
      assignment
    },
    (_, context, _event, { machine, state, action }) => {
      const capturedActions: InvokeActionObject[] = [];

      if (!context) {
        throw new Error(
          'Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.'
        );
      }

      const meta: AssignMeta<TContext, TEvent> = {
        state,
        action,
        _event,
        spawn: createSpawner(machine, context, _event, capturedActions)
      };

      let partialUpdate: Partial<TContext> = {};
      if (isFunction(assignment)) {
        partialUpdate = assignment(context, _event.data, meta);
      } else {
        for (const key of keys(assignment)) {
          const propAssignment = assignment[key];
          partialUpdate[key as any] = isFunction(propAssignment)
            ? propAssignment(context, _event.data, meta)
            : propAssignment;
        }
      }

      capturedActions.push(...capturedState.flushSpawns());

      const updatedContext = Object.assign({}, context, partialUpdate);

      return {
        type: actionTypes.assign,
        params: {
          context: updatedContext,
          actions: capturedActions
        }
      } as AssignActionObject<TContext>;
    }
  );
}
