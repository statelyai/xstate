import { assertEvent, InspectionEvent } from '../src';

describe('assertEvent generics', () => {
  it('narrows a non-generic event the same way as before', () => {
    function handle(event: InspectionEvent) {
      assertEvent(event, '@xstate.event');
      event.event satisfies { type: string };
    }
  });

  it('narrows an event behind a generic type parameter (#5448)', () => {
    // This previously failed to compile: TS couldn't resolve the asserted
    // type for a generic `TEvent`, so every property access on `event`
    // after the assertion errored with "Property '...' does not exist".
    function handle<TEvent extends InspectionEvent>(event: TEvent) {
      assertEvent(event, '@xstate.event');
      event.event satisfies { type: string };
    }
  });

  it('excludes properties that only exist on other members of the generic union', () => {
    // Guards against a fix that widens the assertion instead of narrowing it
    // correctly: `snapshot` exists on other InspectionEvent variants, but not
    // on the one asserted here, so it must still be a type error.
    function handle<TEvent extends InspectionEvent>(event: TEvent) {
      assertEvent(event, '@xstate.event');
      // @ts-expect-error
      event.snapshot;
    }
  });

  it('still rejects an invalid descriptor for a generic type parameter', () => {
    // The compile-time descriptor-validity check must still work when
    // `TEvent` is generic - this is what stops `assertEvent(event, 'typo')`
    // from silently compiling.
    function handle<TEvent extends InspectionEvent>(event: TEvent) {
      // @ts-expect-error
      assertEvent(event, 'not-a-real-descriptor');
    }
  });
});
