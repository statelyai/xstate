import {
  ActorMap,
  BaseActionObject,
  BaseGuardDefinition,
  EventObject,
  MachineContext
} from '.';

export interface PartialMachineTypes {
  input?: Record<string, any>;
  context?: MachineContext;
  events?: EventObject;
  actions?: BaseActionObject;
  // TODO: should this be a union instead?
  actors?: ActorMap;
  guards?: BaseGuardDefinition;
}

type WithDefaultConstraint<T, TDefault> = T extends undefined
  ? TDefault
  : T extends TDefault
  ? T
  : TDefault;

export type CreateMachineTypes<T extends PartialMachineTypes> = {
  input: WithDefaultConstraint<T['input'], MachineContext>;
  context: WithDefaultConstraint<T['context'], MachineContext>;
  events:
    | WithDefaultConstraint<T['events'], EventObject>
    | {
        type: 'xstate.init';
        input: T['input'];
      };
  actions: WithDefaultConstraint<T['actions'], BaseActionObject>;
  // TODO: should this be a union instead?
  actors: WithDefaultConstraint<T['actors'], ActorMap>;
  guards: WithDefaultConstraint<T['guards'], BaseGuardDefinition>;
};

export function createTypes<T extends PartialMachineTypes>(
  types: T
): CreateMachineTypes<T> {
  return types as any;
}
