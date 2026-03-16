import { assertEvent, InspectionEvent } from '../src/index';

describe('assertEvent type tests', () => {
  it('should work with non-generic event types', () => {
    function test(event: InspectionEvent) {
      assertEvent(event, '@xstate.event');
      event.event satisfies any;
    }
  });

  it('should work with generic event types', () => {
    function test<TEVENT extends InspectionEvent>(event: TEVENT) {
      assertEvent(event, '@xstate.event');
      event.event satisfies any;
    }
  });

  it('should work with generic event types and multiple descriptors', () => {
    function test<TEVENT extends InspectionEvent>(event: TEVENT) {
      assertEvent(event, ['@xstate.event', '@xstate.snapshot']);
      event.event satisfies any;
    }
  });

  it('should properly narrow types after assertion', () => {
    type MyEvent = { type: 'foo'; value: string } | { type: 'bar'; count: number };

    function test<T extends MyEvent>(event: T) {
      assertEvent(event, 'foo');
      event.value satisfies string;
      // @ts-expect-error
      event.count;
    }
  });
});
