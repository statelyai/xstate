import isDevelopment from '#is-development';
import { EventDescriptor, EventObject, ExtractEvent } from './types.ts';
import { matchesEventDescriptor, toArray } from './utils.ts';
import { xstateError } from './xstateError.ts';

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
 * @public
 */
export function assertEvent<
  TEvent extends EventObject,
  TAssertedDescriptor extends EventDescriptor<TEvent>
>(
  event: TEvent,
  type: TAssertedDescriptor | readonly TAssertedDescriptor[]
): asserts event is ExtractEvent<TEvent, TAssertedDescriptor> {
  const types = toArray(type);

  const matches = types.some((descriptor) =>
    matchesEventDescriptor(event.type, descriptor as string)
  );

  if (!matches) {
    throw new Error(
      isDevelopment
        ? `Expected event ${JSON.stringify(event)} to have ${
            types.length === 1
              ? `type matching "${types[0]}"`
              : `one of types matching "${types.join('", "')}"`
          }`
        : xstateError(74, event.type, types.join(', '))
    );
  }
}
