import { withDeterminism } from './determinism.ts';
import type {
  EventCases,
  EventObject,
  GenerateOptions,
  Origin,
  Sequence,
  SequenceStep
} from './types.ts';

/** Generation note for a graph traversal that never closed. */
export const TRAVERSAL_LIMIT_NOTE =
  'graph traversal hit its limit (context that changes on every step prevents the graph from closing); random walks still cover these paths';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function eventCandidates(
  machine: any,
  cases: EventCases
): { events: EventObject[]; withoutCases: string[] } {
  const events: EventObject[] = [];
  const withoutCases: string[] = [];
  const types = [...new Set<string>(machine.events)].filter(
    (type) => !type.startsWith('xstate.') && !type.includes('*')
  );
  for (const type of types) {
    const payloads = cases[type];
    if (payloads?.length) {
      for (const payload of payloads) events.push({ ...payload, type });
    } else {
      withoutCases.push(type);
      events.push({ type });
    }
  }
  return { events, withoutCases };
}

/**
 * Advancing exactly to the next deadline fires one timer per step: v5's
 * SimulatedClock does not fire timers scheduled during an increment while v6's
 * does, so a longer jump would diverge on clock semantics alone.
 */
function untilNextTimer(clock: any): number | undefined {
  // SimulatedClock keeps pending timeouts in a private map.
  let next = Infinity;
  for (const { start, timeout } of clock.timeouts.values())
    next = Math.min(next, start + timeout);
  return next === Infinity ? undefined : next - clock.now();
}

const flush = async () => {
  for (let i = 0; i < 3; i++)
    await new Promise((resolve) => setImmediate(resolve));
};

/** Sequences from the v5 graph (shortest, simple) and seeded random walks. */
export async function generateSequences(
  xs: any,
  graph: any,
  machine: any,
  events: EventObject[],
  options: GenerateOptions,
  input?: unknown
): Promise<{ sequences: Sequence[]; generationErrors: string[] }> {
  const raw: Array<{ origin: Origin; steps: SequenceStep[] }> = [];
  const generationErrors: string[] = [];
  const fromPaths = async (origin: Origin, paths: () => any[]) => {
    let result: any[];
    try {
      // The wall clock stays at the epoch during traversal so context that
      // stores `Date.now()` does not keep the graph from closing.
      result = await withDeterminism({ now: () => 0 }, options.seed, paths);
    } catch (err) {
      // Unbounded context makes the state space infinite, and a guard that
      // reads a payload the event cases do not supply throws. Either way the
      // origin is dropped and reported; random walks still run.
      const message = (err as Error).message ?? String(err);
      generationErrors.push(
        `${origin} paths skipped: ${message === 'Traversal limit exceeded' ? TRAVERSAL_LIMIT_NOTE : message}`
      );
      return;
    }
    for (const path of result) {
      raw.push({
        origin,
        steps: path.steps
          .filter((step: any) => step.event.type !== 'xstate.init')
          .map((step: any) => ({ event: step.event }))
      });
    }
  };
  const traversal = { events, limit: 1000, input };
  await fromPaths('shortest', () => graph.getShortestPaths(machine, traversal));
  if (options.simplePaths === false)
    generationErrors.push('simple paths skipped (--no-simple-paths)');
  else
    await fromPaths('simple', () => graph.getSimplePaths(machine, traversal));

  const random = mulberry32(options.seed);
  const randomWalk = async (clock: any): Promise<SequenceStep[]> => {
    const actor = xs.createActor(machine, { clock, input });
    actor.subscribe({ error: () => {} });
    actor.start();
    await flush();
    const steps: SequenceStep[] = [];
    while (
      steps.length < options.steps &&
      actor.getSnapshot().status === 'active'
    ) {
      const snapshot = actor.getSnapshot();
      const candidates: SequenceStep[] = events
        .filter((event) => {
          try {
            return snapshot.can(event);
          } catch (err) {
            // A guard threw on this payload; drop the event for this walk.
            const note = `event '${event.type}' skipped: guard threw: ${(err as Error).message ?? String(err)}`;
            if (!generationErrors.includes(note)) generationErrors.push(note);
            return false;
          }
        })
        .map((event) => ({ event }));
      const ms = untilNextTimer(clock);
      if (ms !== undefined) candidates.push({ advance: ms });
      if (!candidates.length) break;
      const next = candidates[Math.floor(random() * candidates.length)];
      steps.push(next);
      if ('event' in next) actor.send(next.event);
      else clock.increment(next.advance);
      await flush();
    }
    actor.stop();
    return steps;
  };
  for (let walk = 0; walk < options.walks; walk++) {
    const clock = new xs.SimulatedClock();
    const steps = await withDeterminism(clock, options.seed + walk, () =>
      randomWalk(clock)
    );
    raw.push({ origin: 'random', steps });
  }

  const seen = new Set<string>();
  const counts: Record<Origin, number> = { shortest: 0, simple: 0, random: 0 };
  const sequences: Sequence[] = [];
  for (const { origin, steps } of raw) {
    const key = JSON.stringify(steps);
    if (seen.has(key)) continue;
    seen.add(key);
    if (sequences.length >= options.maxSequences) break;
    sequences.push({ id: `${origin}-${counts[origin]++}`, origin, steps });
  }
  return { sequences, generationErrors };
}
