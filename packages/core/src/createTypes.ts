import { EventObject, MachineContext } from '.';

export interface PartialMachineTypes {
  input?: Record<string, any>;
  context?: MachineContext;
  events?: EventObject;
}

type MaybeUnknown<T> = T extends undefined ? unknown : T;

export type CreateMachineTypes<T extends PartialMachineTypes> = {
  input: MaybeUnknown<T['input']>;
  context: MaybeUnknown<T['context']>;
  events: MaybeUnknown<T['events']>;
};

export function createTypes<T extends PartialMachineTypes>(
  types: T
): CreateMachineTypes<T> {
  return null as any;
}
