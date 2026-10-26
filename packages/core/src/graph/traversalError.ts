export function createTraversalError(
  state: string,
  event: string,
  cause: unknown
): Error {
  return new Error(
    `Unable to evaluate graph transition from state ${state} with event ${event}. If the transition needs event payloads, provide representative events using the "events" option.`,
    { cause }
  );
}
