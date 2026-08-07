import type {
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateMachine,
  ExecutableActionObject
} from './types.ts';

export type MachineValidationBoundary =
  | 'input'
  | 'event'
  | 'context'
  | 'state.input'
  | 'state.context'
  | 'emitted'
  | 'output'
  | 'child';

export type MachineValidationEventOrigin = 'external' | 'actor' | 'raised';

export type MachineValidationRequest =
  | {
      kind: 'input';
      machine: AnyStateMachine;
      input: unknown;
    }
  | {
      kind: 'event';
      machine: AnyStateMachine;
      event: AnyEventObject;
      eventOrigin: Exclude<MachineValidationEventOrigin, 'raised'>;
    }
  | {
      kind: 'result';
      machine: AnyStateMachine;
      snapshot: AnyMachineSnapshot;
      effects: readonly ExecutableActionObject[];
    };

/** Runtime schema validator installed through `setup({ validator })`. */
export interface MachineValidator {
  check(request: MachineValidationRequest): Error | undefined;
}
