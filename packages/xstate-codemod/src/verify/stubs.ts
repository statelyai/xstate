import type { StubSpec, Stubs } from './types.ts';

function outcome(spec: StubSpec): () => Promise<unknown> {
  if (spec === 'pending') return () => new Promise(() => {});
  if ('error' in spec) return () => Promise.reject(new Error(spec.error));
  return () => Promise.resolve(spec.done);
}

/**
 * Replaces keyed actors with scripted promise logic. Keyed state machines stay
 * real: they are deterministic and their behavior is part of the trace.
 * Everything else defaults to `'pending'` so no real side effect runs.
 */
export function applyStubs(
  xs: any,
  major: 5 | 6,
  machine: any,
  stubs: Stubs
): any {
  const keyed: Record<string, unknown> =
    (major === 5 ? machine.implementations?.actors : machine.sources?.actors) ??
    {};
  const actors: Record<string, unknown> = {};
  for (const [key, logic] of Object.entries(keyed)) {
    const spec = stubs.actors?.[key];
    if (!spec && logic instanceof xs.StateMachine) continue;
    const run = outcome(spec ?? 'pending');
    actors[key] =
      major === 5 ? xs.fromPromise(run) : xs.createAsyncLogic({ run });
  }
  return machine.provide({
    actors,
    ...(stubs.delays && { delays: stubs.delays })
  });
}
