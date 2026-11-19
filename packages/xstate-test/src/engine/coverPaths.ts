import type { EventObject, Snapshot } from 'xstate';

/** @experimental */
export interface TestCoverStep<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly event: TEvent;
  readonly case: string;
  readonly snapshot: TSnapshot;
  /** Snapshots in order, including the current snapshot. */
  readonly snapshots: readonly TSnapshot[];
}

type Predicate<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = (step: TestCoverStep<TSnapshot, TEvent>) => boolean;

/** @experimental */
export interface TestCoverOptions<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  readonly requirements: Readonly<
    Record<
      string,
      Predicate<TSnapshot, TEvent> | readonly Predicate<TSnapshot, TEvent>[]
    >
  >;
  /** The prototype plans a single walk. */
  readonly maxPaths?: 1;
  readonly maxStepsPerPath?: number;
  /** Number of snapshots exposed per step, including the current one. Defaults to 2. */
  readonly snapshotWindow?: number;
}

type MatchProgress = true | readonly number[];

export function planCoverWalk<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  initial: TSnapshot,
  cover: TestCoverOptions<TSnapshot, TEvent>,
  options: {
    readonly limit: number;
    readonly events: (snapshot: TSnapshot) => readonly TEvent[];
    readonly transition: (snapshot: TSnapshot, event: TEvent) => TSnapshot;
    readonly caseName: (event: TEvent) => string;
    readonly serializeState: (snapshot: TSnapshot) => string;
    readonly stopWhen?: (snapshot: TSnapshot) => boolean;
    readonly toState?: (snapshot: TSnapshot) => boolean;
  }
): TEvent[] {
  const maxSteps = cover.maxStepsPerPath ?? 20;
  const snapshotWindow = cover.snapshotWindow ?? 2;
  if (cover.maxPaths !== undefined && cover.maxPaths !== 1) {
    throw new Error('cover supports a single walk. Set maxPaths to 1.');
  }
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) {
    throw new Error('cover.maxStepsPerPath must be a positive integer.');
  }
  if (!Number.isSafeInteger(snapshotWindow) || snapshotWindow < 2) {
    throw new Error('cover.snapshotWindow must be an integer of at least 2.');
  }
  if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
    throw new Error('cover requires limit to be a positive integer.');
  }

  const requirements = Object.entries(cover.requirements).map(
    ([id, requirement]) => {
      const pattern =
        typeof requirement === 'function' ? [requirement] : requirement;
      if (!pattern.length) {
        throw new Error(
          `Cover requirement "${id}" needs at least one predicate.`
        );
      }
      return { id, pattern };
    }
  );
  if (!requirements.length) {
    throw new Error('cover requires at least one named requirement.');
  }

  interface Candidate {
    snapshot: TSnapshot;
    snapshots: readonly TSnapshot[];
    matches: readonly MatchProgress[];
    events: readonly TEvent[];
  }

  const initialCandidate: Candidate = {
    snapshot: initial,
    snapshots: [initial],
    matches: requirements.map(() => []),
    events: []
  };
  const keyOf = (candidate: Candidate) =>
    JSON.stringify([
      candidate.snapshots.map(options.serializeState),
      candidate.matches
    ]);
  const queue = [initialCandidate];
  const seen = new Set([keyOf(initialCandidate)]);
  let best = initialCandidate;
  let bestCount = 0;
  let limitedByDepth = false;

  function fail(reason: string): never {
    const missing = requirements
      .filter((_, index) => best.matches[index] !== true)
      .map(({ id }) => id);
    throw new Error(
      `cover could not find one walk: ${reason}. ` +
        (missing.length
          ? `Missing from the best walk: ${missing.join(', ')}.`
          : 'The best walk covered all requirements but did not reach toState.')
    );
  }

  for (const candidate of queue) {
    const { snapshot, snapshots, matches, events } = candidate;
    if (options.stopWhen?.(snapshot)) {
      continue;
    }
    if (events.length === maxSteps) {
      limitedByDepth = true;
      continue;
    }

    for (const event of options.events(snapshot)) {
      const nextSnapshot = options.transition(snapshot, event);
      const step = {
        event,
        case: options.caseName(event),
        snapshot: nextSnapshot,
        snapshots: [...snapshots, nextSnapshot]
      };
      const nextMatches = requirements.map<MatchProgress>(
        ({ pattern }, index) => {
          const active = matches[index];
          if (active === true) return true;
          // Start a fresh match at each step and advance overlapping matches.
          const advanced = [0, ...active]
            .filter((position) => pattern[position](step))
            .map((position) => position + 1);
          return advanced.includes(pattern.length) ? true : advanced;
        }
      );
      if (
        nextMatches.every((match) => match === true) &&
        (!options.toState || options.toState(nextSnapshot))
      ) {
        return [...events, event];
      }

      const next: Candidate = {
        snapshot: nextSnapshot,
        snapshots: step.snapshots.slice(-(snapshotWindow - 1)),
        matches: nextMatches,
        events: [...events, event]
      };
      const key = keyOf(next);
      if (seen.has(key)) continue;
      const count = nextMatches.filter((match) => match === true).length;
      if (count > bestCount) {
        best = next;
        bestCount = count;
      }
      if (seen.size >= options.limit) {
        fail(`reached the search limit of ${options.limit} states`);
      }
      seen.add(key);
      queue.push(next);
    }
  }

  fail(
    limitedByDepth
      ? `reached maxStepsPerPath (${maxSteps})`
      : 'exhausted the reachable search states'
  );
}
