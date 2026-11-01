import type {
  EventCases,
  EventObject,
  GenerateOptions,
  Origin,
  Sequence,
  SequenceStep
} from './types.ts';

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
  const fromPaths = (origin: Origin, paths: () => any[]) => {
    let result: any[];
    try {
      result = paths();
    } catch (err) {
      // Unbounded context makes the state space infinite, and a guard that
      // reads a payload the event cases do not supply throws. Either way the
      // origin is dropped and reported; random walks still run.
      generationErrors.push(
        `${origin} paths skipped: ${(err as Error).message ?? String(err)}`
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
  fromPaths('shortest', () => graph.getShortestPaths(machine, traversal));
  fromPaths('simple', () => graph.getSimplePaths(machine, traversal));

  const random = mulberry32(options.seed);
  for (let walk = 0; walk < options.walks; walk++) {
    const clock = new xs.SimulatedClock();
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
