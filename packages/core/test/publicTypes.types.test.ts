import { createActor, createMachine } from '../src/index.ts';
import type * as xstate from '../src/index.ts';

// Type-level plumbing is not part of the public entry point.
type _NotExported = [
  // @ts-expect-error internal helper
  xstate.TODO,
  // @ts-expect-error internal helper
  xstate.IsAny<1>,
  // @ts-expect-error internal helper
  xstate.IsNever<1>,
  // @ts-expect-error internal helper
  xstate.Equals<1, 1>,
  // @ts-expect-error internal helper
  xstate.Cast<1, 1>,
  // @ts-expect-error internal helper
  xstate.Compute<{}>,
  // @ts-expect-error internal helper
  xstate.Prop<{}, 'a'>,
  // @ts-expect-error internal helper
  xstate.HomomorphicOmit<{}, 'a'>,
  // @ts-expect-error internal helper
  xstate.LowInfer<1>,
  // @ts-expect-error internal helper
  xstate.DoNotInfer<1>,
  // @ts-expect-error internal helper
  xstate.SingleOrArray<1>,
  // @ts-expect-error internal helper
  xstate.MaybeLazy<1>,
  // @ts-expect-error internal helper
  xstate.AnyFunction
];

// Referenced by emitted declarations, so still exported.
type _StillExported = [
  xstate.ConditionalRequired<{ a?: 1 }, true>,
  xstate.IsNotNever<1>,
  xstate.NonReducibleUnknown
];

describe('public actor options', () => {
  it('do not accept a parent actor', () => {
    const parent = createActor(createMachine({}));
    // @ts-expect-error `parent` is internal
    createActor(createMachine({}), { parent });
  });
});
