import { expectTypeOf, it } from 'vitest';
import type {
  PropertyGeneratorKind,
  TestAdapter,
  TestSutSession
} from './propertyTest.ts';
import type { PropertySutSession, PropertyTestAdapter } from './deprecated.ts';

interface Toggle {
  type: 'TOGGLE';
}

it('`PropertySutSession` keeps its single, event-typed parameter', () => {
  expectTypeOf<PropertySutSession<Toggle>>().toEqualTypeOf<
    TestSutSession<any, Toggle>
  >();
});

it('`PropertyTestAdapter` defaults to `PropertyGeneratorKind`', () => {
  expectTypeOf<PropertyTestAdapter>().toEqualTypeOf<
    TestAdapter<PropertyGeneratorKind>
  >();
});
