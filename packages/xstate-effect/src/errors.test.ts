import { Cause, Option } from 'effect';
import { expectTypeOf } from 'vitest';
import {
  EffectFailure,
  causeFromError,
  type UnwrapEffectFailure
} from './index.ts';

describe('causeFromError', () => {
  it.each([
    Cause.fail('failed'),
    Cause.die(new Error('defect')),
    Cause.interrupt(123),
    Cause.combine(Cause.fail('failed'), Cause.die('defect'))
  ])('returns the original Cause without losing reasons', (cause) => {
    expect(causeFromError(new EffectFailure(cause))).toBe(cause);
  });

  it.each([
    new Error('ordinary'),
    'failed',
    null,
    undefined,
    { _tag: 'EffectFailure', cause: Cause.die('unrelated') }
  ])('wraps an ordinary error as a typed failure', (error) => {
    expect(
      Option.getOrThrow(Cause.findErrorOption(causeFromError(error)))
    ).toBe(error);
  });

  it('preserves typed failures, plain errors and unions', () => {
    const wrapped = new EffectFailure(
      Cause.fail({ code: 'NOT_FOUND' as const })
    );
    const plain = new Error('ordinary');
    const mixed = (error: typeof wrapped | Error) => causeFromError(error);
    const fromUnknown = (error: unknown) => causeFromError(error);

    expectTypeOf(causeFromError(wrapped)).toEqualTypeOf<
      Cause.Cause<{ code: 'NOT_FOUND' }>
    >();
    expectTypeOf(causeFromError(plain)).toEqualTypeOf<Cause.Cause<Error>>();
    expectTypeOf(mixed).returns.toEqualTypeOf<
      Cause.Cause<{ code: 'NOT_FOUND' } | Error>
    >();
    expectTypeOf(fromUnknown).returns.toEqualTypeOf<Cause.Cause<unknown>>();
    expectTypeOf<UnwrapEffectFailure<typeof wrapped | Error>>().toEqualTypeOf<
      { code: 'NOT_FOUND' } | Error
    >();
    expectTypeOf(
      causeFromError(new EffectFailure(Cause.die('defect')))
    ).toEqualTypeOf<Cause.Cause<never>>();
  });
});
