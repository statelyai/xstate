import type { AnyActor } from './types.ts';

/**
 * The inspection of the durable execution whose transition is running. A
 * durable execution installs it for the duration of each of its transitions:
 *
 * - Snapshot systems created while it is installed belong to the execution, so
 *   they forward inspection to their base system instead of stubbing it out.
 * - Runtime systems constructed while it is installed and active are handed
 *   to `attach`, so creation-time inspection events (the root actor's own
 *   registration, actors spawned during the first transition) can be observed.
 * - `isActive` tells the pure-transition path whether the execution has
 *   observers; when it has none, no inspection event is built.
 *
 * @internal
 */
export interface AmbientInspection {
  attach(system: AnyActor['system']): void;
  isActive(): boolean;
}

let ambientInspection: AmbientInspection | undefined;

/**
 * Whether the running durable execution has inspection observers.
 *
 * @internal
 */
export function isAmbientInspectionActive(): boolean {
  return ambientInspection?.isActive() ?? false;
}

/** @internal */
export function attachAmbientInspector(system: AnyActor['system']): void {
  if (ambientInspection?.isActive()) {
    ambientInspection.attach(system);
  }
}

/** @internal */
export function getAmbientInspection(): AmbientInspection | undefined {
  return ambientInspection;
}

/**
 * Runs `fn` as a transition of the durable execution that owns `inspection`,
 * or outside any durable execution when `inspection` is `undefined`.
 *
 * @internal
 */
export function withSystemInspector<T>(
  inspection: AmbientInspection | undefined,
  fn: () => T
): T {
  const previous = ambientInspection;
  ambientInspection = inspection;
  try {
    return fn();
  } finally {
    ambientInspection = previous;
  }
}
