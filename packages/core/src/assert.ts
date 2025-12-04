import isDevelopment from '#is-development';
import { WILDCARD } from './constants.ts';
import { EventDescriptor, EventObject, ExtractEvent } from './types.ts';
import { toArray } from './utils.ts';

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
): asserts event is ExtractEvent<TEvent, TAssertedDescriptor> {
  const types = toArray(type);

  const matches = types.some((descriptor) =>
    matchesEventDescriptor(event.type, descriptor as string)
  );

  if (!matches) {
    const typesText =
      types.length === 1
        ? `type "${types[0]}"`
        : `one of types "${types.join('", "')}"`;
    throw new Error(
      `Expected event ${JSON.stringify(event)} to have ${typesText}`
    );
  }
}

function matchesEventDescriptor(
  eventType: string,
  descriptor: string
): boolean {
  if (descriptor === eventType) {
    return true;
  }

  if (descriptor === WILDCARD) {
    return true;
  }

  if (!descriptor.endsWith('.*')) {
    return false;
  }

  if (isDevelopment && /.*\*.+/.test(descriptor)) {
    console.warn(
      `Wildcards can only be the last token of an event descriptor (e.g., "event.*") or the entire event descriptor ("*"). Check the "${descriptor}" event.`
    );
  }

  const partialEventTokens = descriptor.split('.');
  const eventTokens = eventType.split('.');

  for (
    let tokenIndex = 0;
    tokenIndex < partialEventTokens.length;
    tokenIndex++
  ) {
    const partialEventToken = partialEventTokens[tokenIndex];
    const eventToken = eventTokens[tokenIndex];

    if (partialEventToken === '*') {
      const isLastToken = tokenIndex === partialEventTokens.length - 1;

      if (isDevelopment && !isLastToken) {
        console.warn(
          `Infix wildcards in transition events are not allowed. Check the "${descriptor}" transition.`
        );
      }

      return isLastToken;
    }

    if (partialEventToken !== eventToken) {
      return false;
    }
  }

  return true;
}
