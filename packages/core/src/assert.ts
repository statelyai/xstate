import { EventDescriptor, EventObject } from './types.ts';
import { matchesEventDescriptor, toArray } from './utils.ts';

// `AssertedEvent` is kept local to this module rather than reusing
// `ExtractEvent` (types.ts) so that the narrowing also resolves when `TEvent` is
// an unresolved generic type parameter, e.g.:
//
// function example<T extends SomeEventUnion>(event: T) {
//   assertEvent(event, 'someType');
//   event.someProp; // previously a type error; now narrows correctly
// }
//
// Two details make that work while still matching what `ExtractEvent` does:
//
// 1. We match `{ type: infer TType }` and test the fresh `TType` parameter
//    instead of indexing `TEvent['type']` inside the distribution over
//    `TEvent`. Indexing a still-unresolved generic `TEvent` leaves the whole
//    conditional opaque, so every property access on the "narrowed" event then
//    fails.
// 2. Testing the inferred `TType` also lets the descriptor check distribute
//    over a union-typed `type` field, so an event like `{ type: 'a' | 'b' }` is
//    still matched by the descriptor `'a'` (mirroring `ExtractEvent`'s
//    `EventDescriptorMatches`). Plain assignability
//    (`TEvent extends { type: 'a' }`) would instead throw such an event away.
type NormalizeAssertedDescriptor<TDescriptor extends string> =
  TDescriptor extends '*'
    ? string
    : TDescriptor extends `${infer TLeading}.*`
      ? `${TLeading}.${string}`
      : TDescriptor;

type AssertedEvent<TEvent extends EventObject, TDescriptor extends string> =
  | (TEvent extends { type: infer TType extends string }
      ? // `true` is the check type here to match both `true` and `boolean`, so a
        // member whose `type` is itself a union (e.g. `'a' | 'b'`) still matches
        // a descriptor for one of its constituents.
        true extends (
          TType extends NormalizeAssertedDescriptor<TDescriptor> ? true : false
        )
        ? TEvent
        : never
      : never)
  | (string extends TEvent['type'] ? TEvent : never);

/**
 * Asserts that the given event object is of the specified type or types. Throws
 * an error if the event object is not of the specified types.
 *
 * @example
 *
 * ```ts
 * // ...
 * entry: ({ event }) => {
 *   assertEvent(event, 'doNothing');
 *   // event is { type: 'doNothing' }
 * },
 * // ...
 * exit: ({ event }) => {
 *   assertEvent(event, 'greet');
 *   // event is { type: 'greet'; message: string }
 *
 *   assertEvent(event, ['greet', 'notify']);
 *   // event is { type: 'greet'; message: string }
 *   // or { type: 'notify'; message: string; level: 'info' | 'error' }
 * },
 * ```
 */
export function assertEvent<
  TEvent extends EventObject,
  TAssertedDescriptor extends EventDescriptor<TEvent>
>(
  event: TEvent,
  type: TAssertedDescriptor | readonly TAssertedDescriptor[]
): asserts event is AssertedEvent<TEvent, TAssertedDescriptor> {
  const types = toArray(type);

  const matches = types.some((descriptor) =>
    matchesEventDescriptor(event.type, descriptor as string)
  );

  if (!matches) {
    const typesText =
      types.length === 1
        ? `type matching "${types[0]}"`
        : `one of types matching "${types.join('", "')}"`;
    throw new Error(
      `Expected event ${JSON.stringify(event)} to have ${typesText}`
    );
  }
}
