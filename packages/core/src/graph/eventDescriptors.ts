import type { EventObject, Snapshot } from '../index.ts';
import { getPropertyEventCaseId } from './coverage.ts';
import { fnv1a } from './utils.ts';

/**
 * A value generator usable by the generator-neutral path runner.
 *
 * `testPaths()` samples concrete event payloads from a `generate` value before
 * traversal, so a generator only has to produce a value from a pseudo-random
 * number source. `@xstate/test` additionally accepts fast-check arbitraries and
 * adapts them to this shape.
 */
export type TestGenerator<T> =
  | ((rng: () => number) => T)
  | { sample: (rng: () => number) => T };

/**
 * Distinguishes the descriptor form (`{ generate, case?, weight?, ... }`) from
 * a bare generator. Generators are opaque adapter values that can themselves
 * be objects with a `generate` *method* (fast-check arbitraries have one), so
 * a `generate` key only marks a descriptor when it does not hold a function;
 * any of the descriptor-only keys marks one regardless.
 */
export function isEventDescriptorObject(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (
    'case' in value ||
    'when' in value ||
    'resolve' in value ||
    'weight' in value
  ) {
    return true;
  }
  return (
    Object.prototype.hasOwnProperty.call(value, 'generate') &&
    typeof (value as { generate: unknown }).generate !== 'function'
  );
}

export function assertTestWeight(
  weight: number | undefined,
  location: string
): number {
  if (weight === undefined) {
    return 1;
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    throw new Error(
      `Property ${location} has an invalid \`weight\` (${String(
        weight
      )}). Weights must be positive, finite numbers.`
    );
  }
  return weight;
}

/** The descriptor shape both entry points accept for a single event case. */
export interface AnyTestEventDescriptor<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly generate?: unknown;
  readonly case?: string;
  readonly weight?: number;
  readonly when?: (context: {
    readonly snapshot: TSnapshot;
    readonly event: TEvent;
  }) => boolean;
  readonly resolve?: (context: {
    readonly snapshot: TSnapshot;
    readonly generated: unknown;
  }) => object | undefined;
}

/** One declared event case, after normalization. */
export interface NormalizedEventCase<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly type: string;
  readonly caseName: string;
  readonly caseId: string;
  readonly generator: unknown;
  readonly weight: number;
  readonly descriptor: AnyTestEventDescriptor<TSnapshot, TEvent>;
}

/**
 * Normalizes the shared `events` option — a map of event type to a bare
 * generator, a descriptor object, or an array of either — into the flat list of
 * declared cases both `propertyTest()` and `testPaths()` work from.
 */
export function normalizeEventDescriptors<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  events: Readonly<Record<string, unknown>>
): {
  readonly cases: readonly NormalizedEventCase<TSnapshot, TEvent>[];
  readonly descriptors: ReadonlyMap<
    string,
    AnyTestEventDescriptor<TSnapshot, TEvent>
  >;
} {
  const descriptors = new Map<
    string,
    AnyTestEventDescriptor<TSnapshot, TEvent>
  >();
  const cases: NormalizedEventCase<TSnapshot, TEvent>[] = [];
  for (const [type, configured] of Object.entries(events ?? {})) {
    const configuredCases = Array.isArray(configured)
      ? configured
      : [configured];
    for (const eventCase of configuredCases) {
      const descriptor: AnyTestEventDescriptor<TSnapshot, TEvent> =
        isEventDescriptorObject(eventCase)
          ? (eventCase as AnyTestEventDescriptor<TSnapshot, TEvent>)
          : { generate: eventCase };
      const caseName = descriptor.case ?? 'default';
      if (!caseName) {
        throw new Error(`Property event case for "${type}" must not be empty`);
      }
      const caseId = getPropertyEventCaseId(type, caseName);
      if (descriptors.has(caseId)) {
        throw new Error(
          `Property event case "${caseName}" is duplicated for "${type}"`
        );
      }
      descriptors.set(caseId, descriptor);
      cases.push({
        type,
        caseName,
        caseId,
        generator: descriptor.generate,
        weight: assertTestWeight(
          descriptor.weight,
          `event case "${caseName}" for "${type}"`
        ),
        descriptor
      });
    }
  }
  return { cases, descriptors };
}

/**
 * The per-case seed used when sampling payloads. Deriving it from the case id
 * keeps each case's samples stable when other cases are added or removed.
 */
export function deriveCaseSeed(seed: number, caseId: string): number {
  return (seed ^ fnv1a(caseId)) >>> 0;
}

/** Draws `count` values from a {@link TestGenerator}. */
export function sampleGenerator(
  generator: unknown,
  rng: () => number,
  count: number
): unknown[] {
  const draw =
    typeof generator === 'function'
      ? (generator as (rng: () => number) => unknown)
      : typeof (generator as { sample?: unknown })?.sample === 'function'
        ? (rng2: () => number) =>
            (generator as { sample: (rng: () => number) => unknown }).sample(
              rng2
            )
        : undefined;
  if (!draw) {
    throw new Error(
      'Path generation requires each `generate` value to be a function `(rng) => value` or an object with a `sample(rng)` method. In `@xstate/test`, fast-check arbitraries are adapted automatically.'
    );
  }
  const values: unknown[] = [];
  for (let index = 0; index < count; index++) {
    values.push(draw(rng));
  }
  return values;
}
