export const storeValidationErrorSymbol = Symbol.for(
  'xstate.store.validationError'
);

export function isStoreValidationError(error: unknown): boolean {
  return (
    !!error && typeof error === 'object' && storeValidationErrorSymbol in error
  );
}
