import { EventObject } from './types.ts';
import { toArray } from './utils.ts';

/**
 * Asserts that the given event object is of the specified type or types.
 * Throws an error if the event object is not of the specified types.
  @example

  ```ts
  // ...
  entry: ({ event }) => {
    assertEvent(event, 'doNothing');
    // event is { type: 'doNothing' }
  },
  // ...
  exit: ({ event }) => {
    assertEvent(event, 'greet');
    // event is { type: 'greet'; message: string }

    assertEvent(event, ['greet', 'notify']);
    // event is { type: 'greet'; message: string }
    // or { type: 'notify'; message: string; level: 'info' | 'error' }
  },
  ```
 */
export function assertEvent<
  TEvent extends EventObject,
  TAssertedType extends TEvent['type']
>(
  event: TEvent,
  type: TAssertedType | TAssertedType[]
): asserts event is TEvent & { type: TAssertedType } {
  const types = toArray(type);
  if (!types.includes(event.type as any)) {
    const typesText =
      types.length === 1
        ? `type "${types[0]}"`
        : `one of types "${types.join('", "')}"`;
    throw new Error(
      `Expected event ${JSON.stringify(event)} to have ${typesText}`
    );
  }
}
