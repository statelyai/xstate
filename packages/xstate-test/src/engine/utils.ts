import type { AnyEventObject, AnyMachineSnapshot } from 'xstate';

export function simpleStringify(value: unknown): string {
  return JSON.stringify(value);
}

/** FNV-1a over a string, as an unsigned 32-bit integer. */
export function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A deterministic 32-bit PRNG (mulberry32), seeded by `seed`. */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Events synthesized from the transitions of the active state nodes. */
export function getAllOwnEvents(snapshot: AnyMachineSnapshot) {
  const events = snapshot.nodes.flatMap((stateNode) =>
    [...stateNode.transitions.values()].flatMap((transitions) =>
      transitions.map((transition) => {
        const event: AnyEventObject = {
          type: transition.eventType,
          ...transition.matches
        };
        if (
          'actorId' in event &&
          (event.type === 'xstate.done.actor' ||
            event.type === 'xstate.error.actor' ||
            event.type === 'xstate.snapshot.actor' ||
            event.type === 'xstate.timeout.actor')
        ) {
          event.sessionId = snapshot.children[event.actorId]?.sessionId;
        }
        return event;
      })
    )
  );
  return events.filter(
    (event, index) =>
      events.findIndex((candidate) => {
        const keys = Object.keys(event);
        return (
          keys.length === Object.keys(candidate).length &&
          keys.every((key) => Object.is(event[key], candidate[key]))
        );
      }) === index
  );
}
