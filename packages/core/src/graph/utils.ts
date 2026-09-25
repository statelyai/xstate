import { TestMeta } from './types.ts';
import { AnyMachineSnapshot, MachineContext } from '../index.ts';

export function simpleStringify(value: any): string {
  return JSON.stringify(value);
}

export function getDescription<T, TContext extends MachineContext>(
  snapshot: AnyMachineSnapshot
): string {
  const contextString = !Object.keys(snapshot.context).length
    ? ''
    : `(${JSON.stringify(snapshot.context)})`;

  const stateStrings = snapshot.nodes
    .filter((sn) => sn.type === 'atomic' || sn.type === 'final')
    .map(({ id, path }) => {
      const meta = snapshot.getMeta()[id] as TestMeta<T, TContext>;
      if (!meta) {
        return `"${path.join('.')}"`;
      }

      const { description } = meta;

      if (typeof description === 'function') {
        return description(snapshot as any);
      }

      return description ? `"${description}"` : JSON.stringify(snapshot.value);
    });

  return (
    `state${stateStrings.length === 1 ? '' : 's'} ` +
    stateStrings.join(', ') +
    ` ${contextString}`.trim()
  );
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
