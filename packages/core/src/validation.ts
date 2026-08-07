import type {
  ActorLogicValidator,
  ActorValidationRequest
} from './validation.types.ts';

export function assertValid(
  validator: ActorLogicValidator,
  request: ActorValidationRequest
): void {
  const error = validator.check(request);
  if (error) {
    throw error;
  }
}
