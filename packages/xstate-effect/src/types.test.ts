import { Context, Effect } from 'effect';
import { setup, type AnyActorLogic } from 'xstate';
import {
  createEffectActor,
  fromEffect,
  setupEffect,
  type RequirementsFrom
} from './index.ts';

/** Invariant type equality. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type IsNever<T> = [T] extends [never] ? true : false;

/** Whether `TWhole` (a requirements union) contains `TPart`. */
type Includes<TWhole, TPart> = [TPart] extends [TWhole] ? true : false;

/**
 * The `R` channel of the Effect returned by `createEffectActor`. It carries
 * the actor's own service requirements alongside `Scope`, so assertions about
 * it use {@link Includes} rather than {@link Equals}.
 */
type ActorRequirements<TLogic extends AnyActorLogic> =
  ReturnType<typeof createEffectActor<TLogic>> extends Effect.Effect<
    any,
    any,
    infer R
  >
    ? R
    : never;

const Alpha = Context.Service<{ a: number }>('Alpha');
const Beta = Context.Service<{ b: string }>('Beta');

const alphaEffect = Alpha.use((alpha) => Effect.succeed(alpha.a));
const betaEffect = Beta.use((beta) => Effect.succeed(beta.b));

type RequirementsOfEffect<T> =
  T extends Effect.Effect<any, any, infer R> ? R : never;

type AlphaRequirement = RequirementsOfEffect<typeof alphaEffect>;
type BetaRequirement = RequirementsOfEffect<typeof betaEffect>;

const alphaLogic = fromEffect(alphaEffect);
const betaLogic = fromEffect(betaEffect);
const plainLogic = fromEffect(Effect.succeed(1));

describe('RequirementsFrom', () => {
  it('collects requirements from Effect logic directly', () => {
    true satisfies Equals<
      RequirementsFrom<typeof alphaLogic>,
      AlphaRequirement
    >;
    false satisfies IsNever<RequirementsFrom<typeof alphaLogic>>;
    true satisfies Includes<
      ActorRequirements<typeof alphaLogic>,
      AlphaRequirement
    >;

    expect(true).toBe(true);
  });

  it('collects requirements from a registered Effect actor', () => {
    const machine = setup({ actors: { alphaLogic } }).createMachine({
      initial: 'a',
      states: { a: { invoke: { src: 'alphaLogic' } } }
    });

    true satisfies Equals<RequirementsFrom<typeof machine>, AlphaRequirement>;
    true satisfies Includes<
      ActorRequirements<typeof machine>,
      AlphaRequirement
    >;

    expect(true).toBe(true);
  });

  it('collects requirements from a registered Effect action', () => {
    const machine = setupEffect({
      actions: {
        alpha: (_args) => Alpha.use((alpha) => Effect.succeed(alpha.a))
      }
    }).createMachine({
      on: {
        GO: (args, enq) => enq(args.actions.alpha, args)
      }
    });

    true satisfies Equals<RequirementsFrom<typeof machine>, AlphaRequirement>;

    expect(true).toBe(true);
  });

  it('collects requirements through a registered child machine', () => {
    const child = setup({ actors: { alphaLogic } }).createMachine({
      initial: 'a',
      states: { a: { invoke: { src: 'alphaLogic' } } }
    });
    const parent = setup({ actors: { child } }).createMachine({
      initial: 'a',
      states: { a: { invoke: { src: 'child' } } }
    });

    true satisfies Equals<RequirementsFrom<typeof parent>, AlphaRequirement>;
    true satisfies Includes<ActorRequirements<typeof parent>, AlphaRequirement>;

    // The gap this type closes: the parent's requirements used to infer
    // `never`, so this probe used to compile.
    // @ts-expect-error -- nested requirements must no longer be `never`
    const probe: IsNever<ActorRequirements<typeof parent>> extends true
      ? 'NESTED_R_IS_NEVER'
      : 'nested ok' = 'NESTED_R_IS_NEVER';
    void probe;

    expect(true).toBe(true);
  });

  it('collects requirements two machine levels deep', () => {
    const grandchild = setup({ actors: { alphaLogic } }).createMachine({
      initial: 'a',
      states: { a: { invoke: { src: 'alphaLogic' } } }
    });
    const child = setup({ actors: { grandchild } }).createMachine({
      initial: 'a',
      states: { a: { invoke: { src: 'grandchild' } } }
    });
    const parent = setup({ actors: { child } }).createMachine({
      initial: 'a',
      states: { a: { invoke: { src: 'child' } } }
    });

    true satisfies Equals<RequirementsFrom<typeof parent>, AlphaRequirement>;
    true satisfies Includes<ActorRequirements<typeof parent>, AlphaRequirement>;

    expect(true).toBe(true);
  });

  it('infers `never` for a machine with no Effect sources', () => {
    const child = setup({ actors: { plainLogic } }).createMachine({
      initial: 'a',
      states: { a: { invoke: { src: 'plainLogic' } } }
    });
    const parent = setup({ actors: { child } }).createMachine({
      initial: 'a',
      states: { a: { invoke: { src: 'child' } } }
    });

    true satisfies IsNever<RequirementsFrom<typeof child>>;
    true satisfies IsNever<RequirementsFrom<typeof parent>>;
    // @ts-expect-error -- a machine with no Effect sources requires nothing
    true satisfies Includes<ActorRequirements<typeof parent>, AlphaRequirement>;

    expect(true).toBe(true);
  });

  it('unions requirements from two different actors', () => {
    const child = setup({ actors: { betaLogic } }).createMachine({
      initial: 'a',
      states: { a: { invoke: { src: 'betaLogic' } } }
    });
    const parent = setup({ actors: { alphaLogic, child } }).createMachine({
      initial: 'a',
      states: { a: { invoke: { src: 'alphaLogic' } } }
    });

    true satisfies Equals<
      RequirementsFrom<typeof parent>,
      AlphaRequirement | BetaRequirement
    >;
    false satisfies Equals<RequirementsFrom<typeof parent>, AlphaRequirement>;
    false satisfies Equals<RequirementsFrom<typeof parent>, BetaRequirement>;
    true satisfies Includes<ActorRequirements<typeof parent>, AlphaRequirement>;
    true satisfies Includes<ActorRequirements<typeof parent>, BetaRequirement>;

    expect(true).toBe(true);
  });
});
