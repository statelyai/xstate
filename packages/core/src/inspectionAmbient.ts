import type { InspectionEvent } from './inspection.ts';

/**
 * The ambiently installed system inspector. Set for the duration of a durable
 * execution's transitions (`createDurable(..., { inspect })`), it makes the
 * pure-transition machinery observable: freshly constructed runtime systems
 * attach it, and snapshot systems created while it is set forward inspection
 * to their base system instead of stubbing it out.
 */
let ambientInspector: ((inspectionEvent: InspectionEvent) => void) | undefined;

/** @internal */
export function hasAmbientInspector(): boolean {
  return ambientInspector !== undefined;
}

/** @internal */
export function getAmbientInspector():
  | ((inspectionEvent: InspectionEvent) => void)
  | undefined {
  return ambientInspector;
}

/**
 * Runs `fn` with systems it creates wired to `inspect` from construction, so
 * creation-time inspection events (the root actor's own registration, actors
 * spawned during the first transition) are observed too.
 *
 * @internal
 */
export function withSystemInspector<T>(
  inspect: ((inspectionEvent: InspectionEvent) => void) | undefined,
  fn: () => T
): T {
  if (!inspect) {
    return fn();
  }
  const previous = ambientInspector;
  ambientInspector = inspect;
  try {
    return fn();
  } finally {
    ambientInspector = previous;
  }
}
