import { AnyEventObject } from '.';
import { toArray } from './utils.ts';

/**
 * Asserts that the given event object is of the specified type or types.
 * Throws an error if the event object is not of the specified types.
  @example

  ```ts
  // ...
  entry: ({ event }) => {
    assertEvent(event, 'greet');
    // event is { type: 'greet'; message: string }

    assertEvent(event, ['greet', 'notify']);
    // event is { type: 'greet'; message: string }
    // or { type: 'notify'; message: string; level: 'info' | 'error' }
  },
  exit: ({ event }) => {
    assertEvent(event, 'doNothing');
    // event is { type: 'doNothing' }
  }
  ```
 */
export function assertEvent<
  TEvent extends EventObject,
  TSpecificType extends TEvent['type']
>(
  eventObject: TEvent,
  type: TSpecificType | TSpecificType[]
): asserts eventObject is TEvent & { type: TSpecificType } {
  const types = toArray(type);
  if (!types.includes(eventObject.type as any)) {
    const typesText =
      types.length === 1
        ? `type "${types[0]}"`
        : `one of types "${types.join('", "')}"`;
    throw new Error(
      `Expected event ${JSON.stringify(eventObject)} to have ${typesText}`
    );
  }
}
