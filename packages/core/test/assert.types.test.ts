import { assertEvent, ExtractEvent, InspectionEvent } from '../src';

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

describe('assertEvent with union-typed `type` fields', () => {
  type Events =
    | { type: 'a' | 'b'; value: string }
    | { type: 'c'; count: number };

  it('narrows a concrete event whose `type` is a union of literals', () => {
    // Regression guard: `{ type: 'a' | 'b' }` is not assignable to
    // `{ type: 'a' }`, so an assertion based on plain assignability collapsed
    // this member to `never` and `event.value` failed with "Property 'value'
    // does not exist on type 'never'". It must still narrow via the matched
    // descriptor `'a'`.
    function handle(event: Events) {
      assertEvent(event, 'a');
      event.value satisfies string;
    }
  });

  it('narrows a generic event whose `type` is a union of literals', () => {
    function handle<TEvent extends Events>(event: TEvent) {
      assertEvent(event, 'a');
      event.value satisfies string;
    }
  });

  it('excludes properties from union members that do not match (concrete)', () => {
    function handle(event: Events) {
      assertEvent(event, 'a');
      // @ts-expect-error `count` only exists on the `{ type: 'c' }` member
      event.count;
    }
  });

  it('excludes properties from union members that do not match (generic)', () => {
    function handle<TEvent extends Events>(event: TEvent) {
      assertEvent(event, 'a');
      // @ts-expect-error `count` only exists on the `{ type: 'c' }` member
      event.count;
    }
  });

  it('still rejects an invalid descriptor for a union-typed `type` field', () => {
    function handleConcrete(event: Events) {
      // @ts-expect-error
      assertEvent(event, 'not-a-real-descriptor');
    }
    function handleGeneric<TEvent extends Events>(event: TEvent) {
      // @ts-expect-error
      assertEvent(event, 'not-a-real-descriptor');
    }
  });
});

describe('partial wildcard event descriptors', () => {
  type Events =
    | { type: 'FEEDBACK' }
    | { type: 'FEEDBACK.GOOD'; value: number }
    | { type: 'OTHER'; other: boolean };
  type NestedEvents =
    | Events
    | { type: 'FEEDBACK.GOOD.DETAILED'; message: string };

  it('preserves the prefix event when narrowing a concrete event', () => {
    function handle(event: Events) {
      assertEvent(event, 'FEEDBACK.*');
      event.type satisfies 'FEEDBACK' | 'FEEDBACK.GOOD';
      // @ts-expect-error the prefix event has no value
      event.value;

      if (event.type === 'FEEDBACK') {
        event satisfies { type: 'FEEDBACK' };
      }
      if (event.type === 'FEEDBACK.GOOD') {
        event.value satisfies number;
      }
      // @ts-expect-error unrelated events are excluded
      event.other;
    }
  });

  it('preserves the prefix event when narrowing an event with a generic payload', () => {
    function handle<TValue>(
      event:
        | { type: 'FEEDBACK' }
        | { type: 'FEEDBACK.GOOD'; value: TValue }
        | { type: 'OTHER'; other: boolean }
    ) {
      assertEvent(event, 'FEEDBACK.*');
      event.type satisfies 'FEEDBACK' | 'FEEDBACK.GOOD';
      // @ts-expect-error the prefix event has no value
      event.value;

      if (event.type === 'FEEDBACK') {
        event satisfies { type: 'FEEDBACK' };
      }
      if (event.type === 'FEEDBACK.GOOD') {
        event.value satisfies TValue;
      }
      // @ts-expect-error unrelated events are excluded
      event.other;
    }
  });

  it('preserves nested prefixes in descriptor arrays', () => {
    function handle(event: NestedEvents) {
      assertEvent(event, ['FEEDBACK.GOOD.*', 'OTHER']);
      event.type satisfies 'FEEDBACK.GOOD' | 'FEEDBACK.GOOD.DETAILED' | 'OTHER';

      if (event.type === 'FEEDBACK.GOOD') {
        event.value satisfies number;
      }
      // @ts-expect-error only the detailed event has a message
      event.message;
    }
  });

  it('includes bare and nested prefixes in ExtractEvent', () => {
    const prefix: ExtractEvent<Events, 'FEEDBACK.*'> = { type: 'FEEDBACK' };
    const nestedPrefix: ExtractEvent<NestedEvents, 'FEEDBACK.GOOD.*'> = {
      type: 'FEEDBACK.GOOD',
      value: 42
    };

    prefix.type satisfies 'FEEDBACK';
    nestedPrefix.value satisfies number;
  });
});
