/**
 * This function makes sure that unhandled errors are thrown in a separate macrotask.
 * It allows those errors to be detected by global error handlers and reported to bug tracking services
 * without interrupting our own stack of execution.
 *
 * @param err error to be thrown
 */
export function reportUnhandledError(err: unknown) {
  setTimeout(() => {
    throw err;
  });
}
