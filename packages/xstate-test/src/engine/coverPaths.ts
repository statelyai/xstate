import type { EventObject, Snapshot } from 'xstate';
import type { StatePath, Step } from 'xstate/graph';
import { XSTATE_INIT } from './constants.ts';

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
  /** Optional upper bound on the number of fresh SUT sessions. */
  readonly maxPaths?: number;
  readonly maxStepsPerPath?: number;
  /** Number of snapshots exposed per step, including the current one. Defaults to 2. */
  readonly snapshotWindow?: number;
}

type MatchProgress = true | readonly number[];

export function planCoverPaths<
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
): StatePath<TSnapshot, TEvent>[] {
  const maxSteps = cover.maxStepsPerPath ?? 20;
  const snapshotWindow = cover.snapshotWindow ?? 2;
  if (
    cover.maxPaths !== undefined &&
    (!Number.isSafeInteger(cover.maxPaths) || cover.maxPaths < 1)
  ) {
    throw new Error('cover.maxPaths must be a positive integer.');
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
    ([id, requirement], index) => {
      const pattern =
        typeof requirement === 'function' ? [requirement] : requirement;
      if (!pattern.length) {
        throw new Error(
          `Cover requirement "${id}" needs at least one predicate.`
        );
      }
      return { id, pattern, bit: 1n << BigInt(index) };
    }
  );
  if (!requirements.length) {
    throw new Error('cover requires at least one named requirement.');
  }

  const fullCoverage = (1n << BigInt(requirements.length)) - 1n;
  const maxPaths = Math.min(
    cover.maxPaths ?? requirements.length,
    requirements.length
  );

  interface Candidate {
    snapshot: TSnapshot;
    snapshots: readonly TSnapshot[];
    matches: readonly MatchProgress[];
    steps: readonly Step<TSnapshot, TEvent>[];
  }

  const initialCandidate: Candidate = {
    snapshot: initial,
    snapshots: [initial],
    matches: requirements.map(() => []),
    steps: []
  };
  const keyOf = (candidate: Candidate) =>
    JSON.stringify([
      candidate.snapshots.map(options.serializeState),
      candidate.matches
    ]);
  const queue = [initialCandidate];
  const seen = new Set([keyOf(initialCandidate)]);
  type Walk = readonly Step<TSnapshot, TEvent>[];
  const shortestWalks = new Map<bigint, Walk>();
  let availableCoverage = 0n;
  let bestCoverage = 0n;
  let bestCount = 0;
  let limitedByDepth = false;

  function recordBest(covered: bigint): void {
    const count = requirements.filter(
      ({ bit }) => (covered & bit) !== 0n
    ).length;
    if (count > bestCount) {
      bestCoverage = covered;
      bestCount = count;
    }
  }

  function toPath(walk: Walk): StatePath<TSnapshot, TEvent> {
    return {
      state: walk[walk.length - 1].state,
      steps: [
        { state: initial, event: { type: XSTATE_INIT } as TEvent },
        ...walk
      ],
      weight: walk.length
    };
  }

  function fail(reason: string, covered = bestCoverage): never {
    const missing = requirements
      .filter(({ bit }) => (covered & bit) === 0n)
      .map(({ id }) => id);
    throw new Error(
      `cover could not finish planning: ${reason}.` +
        (missing.length ? ` Missing requirements: ${missing.join(', ')}.` : '')
    );
  }

  for (const candidate of queue) {
    const { snapshot, snapshots, matches, steps } = candidate;
    if (snapshot.status !== 'active' || options.stopWhen?.(snapshot)) {
      continue;
    }
    if (steps.length === maxSteps) {
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
      const nextSteps = [...steps, { event, state: nextSnapshot }];
      if (!options.toState || options.toState(nextSnapshot)) {
        const covered = requirements.reduce(
          (bits, { bit }, index) =>
            nextMatches[index] === true ? bits | bit : bits,
          0n
        );
        if (covered === fullCoverage) {
          return [toPath(nextSteps)];
        }
        // Breadth-first traversal finds the shortest eligible walk for each set.
        if (covered && !shortestWalks.has(covered)) {
          shortestWalks.set(covered, nextSteps);
          availableCoverage |= covered;
          recordBest(covered);
        }
      }

      const next: Candidate = {
        snapshot: nextSnapshot,
        snapshots: step.snapshots.slice(-(snapshotWindow - 1)),
        matches: nextMatches,
        steps: nextSteps
      };
      const key = keyOf(next);
      if (seen.has(key)) continue;
      if (seen.size >= options.limit) {
        fail(`reached the search limit of ${options.limit} states`);
      }
      seen.add(key);
      queue.push(next);
    }
  }

  if (availableCoverage !== fullCoverage) {
    fail(
      limitedByDepth
        ? `reached maxStepsPerPath (${maxSteps})`
        : 'exhausted the reachable search states',
      availableCoverage
    );
  }

  // Search by session count. At each count, retain the lowest action cost
  // for each set of requirements met, since future sessions start fresh.
  interface Plan {
    readonly walks: readonly Walk[];
    readonly steps: number;
  }

  let plans = new Map<bigint, Plan>();
  for (const [covered, walk] of shortestWalks) {
    plans.set(covered, { walks: [walk], steps: walk.length });
  }
  let remaining = options.limit - seen.size;
  for (let count = 2; count <= maxPaths; count++) {
    const nextPlans = new Map<bigint, Plan>();
    for (const [covered, plan] of plans) {
      for (const [walkCoverage, walk] of shortestWalks) {
        const combined = covered | walkCoverage;
        const steps = plan.steps + walk.length;
        if (remaining-- <= 0) {
          fail(
            `reached the search limit of ${options.limit} while combining walks`
          );
        }
        if (
          combined === covered ||
          (nextPlans.get(combined)?.steps ?? Infinity) <= steps
        ) {
          continue;
        }
        nextPlans.set(combined, { walks: [...plan.walks, walk], steps });
        recordBest(combined);
      }
    }
    const complete = nextPlans.get(fullCoverage);
    if (complete) return complete.walks.map(toPath);
    plans = nextPlans;
  }

  fail(`reached maxPaths (${maxPaths})`);
}
