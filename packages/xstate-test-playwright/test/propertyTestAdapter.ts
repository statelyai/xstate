/**
 * A dependency-free `PropertyTestAdapter` used to exercise the
 * `xstate/graph` property-testing surface from within this package.
 *
 * It is deliberately minimal: a seeded `mulberry32` PRNG, plain
 * `{ sample(rng) }` generators, uniformly random command sequences and no
 * shrinking. Real users should prefer `@xstate/fast-check`.
 */
import type { EventObject, Snapshot } from 'xstate';
import type {
  PropertyGeneratorKind,
  PropertyScenarioRunner,
  PropertyTestAdapter,
  PropertyTestAdapterRequest,
  PropertyTestAdapterResult
} from 'xstate/graph';

export type Rng = () => number;

export interface Gen<TValue> {
  sample(rng: Rng): TValue;
}

/** The generator kind used by {@link randomAdapter}. */
export interface RandomGeneratorKind extends PropertyGeneratorKind {
  readonly generator: Gen<this['target']>;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gen<TValue>(sample: (rng: Rng) => TValue): Gen<TValue> {
  return { sample };
}

export function constant<const TValue>(value: TValue): Gen<TValue> {
  return gen(() => value);
}

export function integer(min: number, max: number): Gen<number> {
  return gen((rng) => min + Math.floor(rng() * (max - min + 1)));
}

export function record<TValue extends Record<string, unknown>>(generators: {
  readonly [TKey in keyof TValue]: Gen<TValue[TKey]>;
}): Gen<TValue> {
  return gen((rng) => {
    const value = {} as TValue;
    for (const key of Object.keys(generators) as (keyof TValue)[]) {
      value[key] = generators[key].sample(rng);
    }
    return value;
  });
}

export function oneOf<TValue>(...values: readonly TValue[]): Gen<TValue> {
  return gen((rng) => values[Math.floor(rng() * values.length)]);
}

export interface RandomAdapterOptions {
  readonly seed?: number;
  readonly numRuns?: number;
  readonly maxCommands?: number;
}

interface Step<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> {
  check(runner: PropertyScenarioRunner<TSnapshot, TEvent>): boolean;
  run(runner: PropertyScenarioRunner<TSnapshot, TEvent>): Promise<void>;
}

type StepFactory<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> = (rng: Rng) => Step<TSnapshot, TEvent>;

class RandomAdapter implements PropertyTestAdapter<RandomGeneratorKind> {
  public readonly kind?: RandomGeneratorKind;

  public constructor(private readonly options: RandomAdapterOptions) {}

  public async run<
    TSnapshot extends Snapshot<unknown>,
    TEvent extends EventObject
  >(
    request: PropertyTestAdapterRequest<TSnapshot, TEvent>
  ): Promise<PropertyTestAdapterResult> {
    const factories: StepFactory<TSnapshot, TEvent>[] = [];
    for (const { type, caseId, generator } of request.events) {
      factories.push((rng) => {
        const generated = (generator as Gen<unknown>).sample(rng);
        return {
          check: (runner) => runner.canRunGenerated(type, generated, caseId),
          run: (runner) => runner.runGenerated(type, generated, caseId)
        };
      });
    }
    for (const command of request.commands) {
      if (command.type === 'advance') {
        factories.push((rng) => {
          const milliseconds = (command.generator as Gen<number>).sample(rng);
          return {
            check: (runner) =>
              runner.canRunCommand(runner.getSnapshot().status === 'active'),
            run: (runner) => runner.advance(milliseconds)
          };
        });
      } else if (command.type === 'checkpoint') {
        factories.push((rng) => {
          const value = (
            command.generator as Gen<{ readonly label?: string }>
          ).sample(rng);
          return {
            check: (runner) => runner.canRunCommand(true),
            run: (runner) => runner.checkpoint(value.label)
          };
        });
      } else {
        factories.push((rng) => {
          (command.generator as Gen<unknown>).sample(rng);
          return {
            check: (runner) =>
              runner.canRunCommand(runner.getSnapshot().status === 'active'),
            run: (runner) => runner.stop()
          };
        });
      }
    }
    if (!factories.length) {
      throw new Error(
        'Property tests require at least one event or command generator'
      );
    }

    const seed = this.options.seed ?? 0;
    const maxCommands = this.options.maxCommands ?? 10;
    const configuredRuns = request.runBudget ?? this.options.numRuns ?? 10;
    let runs = 0;
    let error: unknown;

    for (let runIndex = 0; runIndex < configuredRuns; runIndex++) {
      const rng = mulberry32(seed + runIndex);
      const runner = request.createRunner();
      runs++;
      try {
        await runner.start();
        const length = 1 + Math.floor(rng() * maxCommands);
        for (let index = 0; index < length; index++) {
          const step = factories[Math.floor(rng() * factories.length)](rng);
          if (!step.check(runner)) {
            continue;
          }
          await step.run(runner);
        }
        runner.finish();
      } catch (cause) {
        error = cause;
      } finally {
        await runner.dispose();
      }
      if (error !== undefined) {
        break;
      }
    }

    const truncationReasons: string[] = [];
    if (error !== undefined && runs < configuredRuns) {
      truncationReasons.push(
        'counterexample found before configured runs completed'
      );
    }
    const exploration = {
      configuredRuns,
      maximumSequenceLength: maxCommands,
      engine: 'random',
      seed,
      truncated: truncationReasons.length > 0,
      truncationReasons
    };
    if (error === undefined) {
      return { runs, exploration };
    }
    return {
      runs,
      exploration,
      error,
      replay: { engine: 'random', seed: seed + runs - 1 }
    };
  }
}

export function randomAdapter(
  options: RandomAdapterOptions = {}
): PropertyTestAdapter<RandomGeneratorKind> {
  return new RandomAdapter(options);
}
