import { AnyEventObject } from '.';
import { toArray } from './utils';

export function assertEvent<
  TEvent extends AnyEventObject,
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
