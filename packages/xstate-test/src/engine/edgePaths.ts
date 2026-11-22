import type { EventObject, Snapshot } from 'xstate';
import type { StatePath } from 'xstate/graph';
import { XSTATE_INIT } from './constants.ts';

export function planEdgePaths<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  initial: TSnapshot,
  options: {
    limit: number;
    events: (snapshot: TSnapshot) => readonly TEvent[];
    resolveStep: (
      snapshot: TSnapshot,
      event: TEvent
    ) => { kind: 'edge' | 'probe'; state: TSnapshot } | undefined;
    serializeState: (
      snapshot: TSnapshot,
      event: TEvent | undefined,
      previous: TSnapshot | undefined
    ) => string;
    stopWhen?: ((snapshot: TSnapshot) => boolean) | undefined;
    toState?: ((snapshot: TSnapshot) => boolean) | undefined;
  }
): StatePath<TSnapshot, TEvent>[] {
  const { limit, events, resolveStep, serializeState, stopWhen, toState } =
    options;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Edge traversal limit must be a positive integer.');
  }

  const start: StatePath<TSnapshot, TEvent> = {
    state: initial,
    steps: [],
    weight: 0
  };
  const paths = toState && !toState(initial) ? [] : [start];
  const prefixes = [start];
  const seen = new Set([serializeState(initial, undefined, undefined)]);
  let planned = 1;

  // Breadth-first discovery keeps one shortest prefix per state. Every
  // outgoing choice gets a run, including loops and shared destinations.
  for (const prefix of prefixes) {
    if (prefix.state.status !== 'active' || stopWhen?.(prefix.state)) {
      continue;
    }
    for (const event of events(prefix.state)) {
      if (event.type === XSTATE_INIT) {
        throw new Error(
          `"${XSTATE_INIT}" is reserved for test initialization.`
        );
      }
      const step = resolveStep(prefix.state, event);
      if (!step) {
        continue;
      }
      if (planned++ >= limit) {
        throw new Error('Traversal limit exceeded');
      }
      const { kind, state } = step;
      const path = {
        state,
        steps: [...prefix.steps, { state, event }],
        weight: prefix.weight + 1
      };
      if (!toState || toState(state)) {
        paths.push(path);
      }
      if (kind === 'probe') {
        continue;
      }
      const key = serializeState(state, event, prefix.state);
      if (!seen.has(key)) {
        seen.add(key);
        prefixes.push(path);
      }
    }
  }
  return paths;
}
