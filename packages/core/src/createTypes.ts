import { EventObject, MachineContext } from '.';

export interface PartialMachineTypes {
  input?: Record<string, any>;
  context?: MachineContext;
  events?: EventObject;
}

type MaybeUnknown<T, TDefault> = T extends undefined
  ? TDefault
  : T extends TDefault
  ? T
  : TDefault;

export type CreateMachineTypes<T extends PartialMachineTypes> = {
  input: MaybeUnknown<T['input'], MachineContext>;
  context: MaybeUnknown<T['context'], MachineContext>;
  events: MaybeUnknown<T['events'], EventObject> & {
    type: 'xstate.init';
    input: T['input'];
  };
};

export function createTypes<T extends PartialMachineTypes>(
  types: T
): CreateMachineTypes<T> {
  return null as any;
}
