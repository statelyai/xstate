import * as fc from 'fast-check';
import type { Snapshot } from 'xstate';
import { createPickDescriptor, type TestPickDescriptor } from 'xstate/graph';

/**
 * An event case whose payload refers to something in the current snapshot,
 * such as an item that is already in a cart. `select` lists the candidates;
 * the case is inapplicable when it returns none. `toPayload` turns the picked
 * candidate into the event payload, and defaults to using it as the payload.
 *
 * The index into the candidates is generated with `fc.nat()`, so a failing
 * run shrinks towards the first candidate. The snapshot type is inferred from
 * the `events` map it is assigned to.
 *
 * ```ts
 * events: {
 *   REMOVE: pick(
 *     (snapshot) => Object.keys(snapshot.context.items),
 *     (sku) => ({ sku })
 *   )
 * }
 * ```
 */
export function pick<TSnapshot extends Snapshot<unknown>, TPayload>(
  select: (snapshot: TSnapshot) => readonly TPayload[]
): TestPickDescriptor<fc.Arbitrary<number>, TSnapshot, TPayload>;
export function pick<TSnapshot extends Snapshot<unknown>, TItem, TPayload>(
  select: (snapshot: TSnapshot) => readonly TItem[],
  toPayload: (item: TItem, snapshot: TSnapshot) => TPayload
): TestPickDescriptor<fc.Arbitrary<number>, TSnapshot, TPayload>;
export function pick<TSnapshot extends Snapshot<unknown>, TItem, TPayload>(
  select: (snapshot: TSnapshot) => readonly TItem[],
  toPayload?: (item: TItem, snapshot: TSnapshot) => TPayload
): TestPickDescriptor<fc.Arbitrary<number>, TSnapshot, TPayload> {
  return createPickDescriptor(fc.nat(), select, toPayload);
}
