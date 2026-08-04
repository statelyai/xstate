import { EventDescriptor, EventObject } from './types.ts';
import { matchesEventDescriptor, toArray } from './utils.ts';

// Mirrors the wildcard normalization in `NormalizeDescriptor` (types.ts), but is
// kept local to this module (rather than reusing `ExtractEvent`) so that the
// narrowed type stays a single-level conditional over `TEvent`. `ExtractEvent`
// nests a `TEvent['type']` check inside the branch of a distributive conditional
// over `TEvent`, and TypeScript can't eagerly resolve that when `TEvent` is
// itself an unresolved generic type parameter (e.g. `<T extends SomeEventUnion>`)
// - it leaves the whole expression as an opaque, unexpanded type, so every
// property access on the "narrowed" event then fails. Keeping the wildcard
// normalization and the `TEvent` distribution as siblings (joined by `|`
// instead of nested) lets TypeScript resolve each branch independently, so the
// narrowing also works for generic callers, e.g.:
//
// function example<T extends SomeEventUnion>(event: T) {
//   assertEvent(event, 'someType');
//   event.someProp; // previously a type error; now narrows correctly
// }
type NormalizeAssertedDescriptor<TDescriptor extends string> =
  TDescriptor extends '*'
    ? string
    : TDescriptor extends `${infer TLeading}.*`
      ? `${TLeading}.${string}`
      : TDescriptor;

type AssertedEvent<TEvent extends EventObject, TDescriptor extends string> =
  | (TEvent extends { type: NormalizeAssertedDescriptor<TDescriptor> }
      ? TEvent
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
