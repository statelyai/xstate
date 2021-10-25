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

    const acceptUserModelEvent = (_event: UserModelEvent) => {};

    acceptUserModelEvent({ type: 'updateName', value: 'test' });
    acceptUserModelEvent({ type: 'updateAge', value: 12 });
    acceptUserModelEvent({ type: 'anotherEvent' });
    acceptUserModelEvent({
      /* @ts-expect-error */
      type: 'eventThatDoesNotExist'
    });
  });

  it('should narrow events down to the specified types', () => {
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

    type UserModelEventSubset = EventFrom<
      typeof userModel,
      'updateName' | 'updateAge'
    >;

    const acceptUserModelEventSubset = (
      _userModelEventSubset: UserModelEventSubset
    ) => {};

    acceptUserModelEventSubset({ type: 'updateName', value: 'test' });
    acceptUserModelEventSubset({ type: 'updateAge', value: 12 });
    /* @ts-expect-error */
    acceptUserModelEventSubset({ type: 'anotherEvent' });
    /* @ts-expect-error */
    acceptUserModelEventSubset({ type: 'eventThatDoesNotExist' });
  });
});
