import { EventFrom } from '../src';
import { createModel } from '../src/model';

describe('EventFrom', () => {
  it('should return events for createModel', () => {
    const userModel = createModel(
      {},
      {
        events: {
          updateName: (value: string) => ({ value }),
          updateAge: (value: number) => ({ value }),
          anotherEvent: () => ({})
        }
      }
    );

    type UserModelEvent = EventFrom<typeof userModel>;

    const noop = (_event: UserModelEvent) => {};

    noop({ type: 'updateName', value: 'test' });
    noop({ type: 'updateAge', value: 12 });
    noop({ type: 'anotherEvent' });
    noop({
      /* @ts-expect-error */
      type: 'eventThatDoesNotExist'
    });
  });

  it('should narrow events down to the specified type(s)', () => {
    const userModel = createModel(
      {},
      {
        events: {
          updateName: (value: string) => ({ value }),
          updateAge: (value: number) => ({ value }),
          anotherEvent: () => ({})
        }
      }
    );

    type UpdateNameEvent = EventFrom<typeof userModel, 'updateName'>;

    const noop = (_updateNameEvent: UpdateNameEvent) => {};

    noop({ type: 'updateName', value: 'test' });

    /* @ts-expect-error */
    noop({ type: 'updateAge', value: 12 });

    /* @ts-expect-error */
    noop({ type: 'anotherEvent' });

    /* @ts-expect-error */
    noop({ type: 'eventThatDoesNotExist' });
  });
});
