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
