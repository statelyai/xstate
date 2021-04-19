import { EventObject, ExtractEvent } from './types';

export function assertEvent<
  TEventType extends TEvent['type'],
  TEvent extends EventObject = EventObject
>(e: TEvent, type: TEventType): asserts e is ExtractEvent<TEvent, TEventType>;
export function assertEvent<
  TEventType extends TEvent['type'],
  TEvent extends EventObject = EventObject
>(e: TEvent, type: TEventType[]): asserts e is ExtractEvent<TEvent, TEventType>;
export function assertEvent<TEvent extends EventObject = EventObject>(
  e: TEvent,
  types: string | string[]
) {
  types = Array.isArray(types) ? types : [types];
  if (!types.includes(e.type)) {
    throw new Error(
      `Expected event${types.length > 1 ? 's' : ''} "${types.join(
        ', '
      )}" but got "${e.type}".`
    );
  }
}
