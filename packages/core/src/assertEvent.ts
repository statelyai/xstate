import { EventObject, ExtractEvent } from './types';

export function assertEvent<
  TEvent extends EventObject,
  TEventType extends TEvent['type']
>(
  event: TEvent,
  type: TEventType
): asserts event is ExtractEvent<TEvent, TEventType>;
export function assertEvent<
  TEvent extends EventObject,
  TEventType extends TEvent['type']
>(
  event: TEvent,
  type: TEventType[]
): asserts event is ExtractEvent<TEvent, TEventType>;
export function assertEvent<TEvent extends EventObject>(
  event: TEvent,
  types: string | string[]
) {
  types = Array.isArray(types) ? types : [types];
  if (!types.includes(event.type)) {
    throw new Error(
      `Expected event${types.length > 1 ? 's' : ''} "${types.join(
        ', '
      )}" but got "${event.type}".`
    );
  }
}
