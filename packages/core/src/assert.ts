import { AnyActorLogic, AnyEventObject, SnapshotFrom } from '.';

export function assertEvent<
  TEvent extends AnyEventObject,
  TSpecificType extends TEvent['type']
>(
  eventObject: TEvent,
  type: TSpecificType
): asserts eventObject is TEvent & { type: TSpecificType } {
  if (eventObject.type !== type) {
    throw new Error(
      `Expected event ${JSON.stringify(eventObject)} to have type "${type}"`
    );
  }
}
