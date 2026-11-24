/**
 * Builds the production message for an XState error: the stable code, the
 * dynamic values, and a link to its entry in docs/errors.md. Development
 * builds use the full message instead, so call sites read `isDevelopment ?
 * fullMessage : xstateError(code, ...values)` and the full text tree-shakes
 * out of production bundles.
 */
export function xstateError(code: number, ...values: unknown[]): string {
  return `XState error E${code}${
    values.length
      ? ` (${values
          .map((value) =>
            typeof value === 'string' ? JSON.stringify(value) : String(value)
          )
          .join(', ')})`
      : ''
  }. See https://github.com/statelyai/xstate/blob/next/docs/errors.md#e${code}`;
}
