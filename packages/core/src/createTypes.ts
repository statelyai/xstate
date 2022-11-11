import type {
  ActorMap,
  BaseActionObject,
  BaseGuardDefinition,
  EventObject,
  MachineContext
} from './types';

export interface PartialMachineTypes {
  input?: Record<string, any>;
  context?: MachineContext;
  events?: EventObject;
  actions?: BaseActionObject;
  // TODO: should this be a union instead?
  actors?: ActorMap;
  guards?: BaseGuardDefinition;
  foo?: any;
}

type WithDefaultConstraint<
  T,
  TDefault,
  TConstraint = TDefault
> = unknown extends T ? TDefault : T extends TConstraint ? T : never;

export type CreateMachineTypes<T extends PartialMachineTypes> = {
  input: WithDefaultConstraint<T['input'], undefined, MachineContext>;
  context: WithDefaultConstraint<T['context'], MachineContext>;
  events:
    | WithDefaultConstraint<T['events'], EventObject>
    | {
        type: 'xstate.init';
        input: T['input'];
      };
  actions: WithDefaultConstraint<T['actions'], BaseActionObject>;
  actors: WithDefaultConstraint<T['actors'], ActorMap>;
  guards: WithDefaultConstraint<T['guards'], BaseGuardDefinition>;
};

export function createTypes<T extends PartialMachineTypes>(
  types: T
): CreateMachineTypes<T> {
  return types as any;
}
