import type {
  AnyActorLogic,
  AnyEventObject,
  ExecutableActionObject,
  Snapshot
} from './types.ts';

export type ActorValidationBoundary =
  | 'input'
  | 'event'
  | 'context'
  | 'state.input'
  | 'state.context'
  | 'emitted'
  | 'output'
  | 'child';

export type ActorValidationEventOrigin = 'external' | 'actor' | 'raised';

export type ActorValidationRequest =
  | {
      kind: 'input';
      logic: AnyActorLogic;
      input: unknown;
    }
  | {
      kind: 'event';
      logic: AnyActorLogic;
      event: AnyEventObject;
      eventOrigin: Exclude<ActorValidationEventOrigin, 'raised'>;
    }
  | {
      kind: 'result';
      logic: AnyActorLogic;
      snapshot: Snapshot<unknown>;
      effects: readonly ExecutableActionObject[];
    };

/** Runtime schema validator installed on actor logic. */
export interface ActorLogicValidator {
  check(request: ActorValidationRequest): Error | undefined;
}
