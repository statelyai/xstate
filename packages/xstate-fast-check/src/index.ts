import * as fc from 'fast-check';
import type {
  PropertyGeneratorKind,
  PropertyScenarioRunner,
  PropertyTestAdapter,
  PropertyTestAdapterRequest,
  PropertyTestAdapterResult
} from 'xstate/graph';
import type { EventObject, Snapshot } from 'xstate';

export interface FastCheckGeneratorKind extends PropertyGeneratorKind {
  readonly generator: fc.Arbitrary<this['target']>;
}

export interface FastCheckAdapterOptions extends Omit<
  fc.Parameters<unknown>,
  'examples'
> {
  readonly maxCommands?: number;
  readonly replayPath?: string;
}

class PropertyCommand<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> implements fc.AsyncCommand<
  PropertyScenarioRunner<TSnapshot, TEvent>,
  undefined,
  false
> {
  public constructor(public readonly event: TEvent) {}

  public check(
    runner: Readonly<PropertyScenarioRunner<TSnapshot, TEvent>>
  ): boolean {
    return runner.canRun(this.event);
  }

  public async run(
    runner: PropertyScenarioRunner<TSnapshot, TEvent>
  ): Promise<void> {
    await runner.run(this.event);
  }

  public toString(): string {
    return JSON.stringify(this.event);
  }
}

class FastCheckAdapter implements PropertyTestAdapter<FastCheckGeneratorKind> {
  declare public readonly kind?: FastCheckGeneratorKind;

  public constructor(private readonly options: FastCheckAdapterOptions) {}

  public async run<
    TSnapshot extends Snapshot<unknown>,
    TEvent extends EventObject
  >(
    request: PropertyTestAdapterRequest<TSnapshot, TEvent>
  ): Promise<PropertyTestAdapterResult> {
    const commands: fc.Arbitrary<
      fc.AsyncCommand<
        PropertyScenarioRunner<TSnapshot, TEvent>,
        undefined,
        false
      >
    >[] = request.events.map(({ type, generator }) =>
      (generator as fc.Arbitrary<unknown>).map(
        (payload) => new PropertyCommand(request.createEvent(type, payload))
      )
    );
    const commandSequence = fc.commands<
      PropertyScenarioRunner<TSnapshot, TEvent>,
      undefined,
      false
    >(commands, {
      maxCommands: this.options.maxCommands,
      replayPath: this.options.replayPath
    });
    const property = fc.asyncProperty(commandSequence, async (generated) => {
      const runner = request.createRunner();
      await runner.start();
      await fc.asyncModelRun(
        () => ({ model: runner, real: undefined }),
        generated
      );
    });
    const { maxCommands: _, replayPath: __, ...parameters } = this.options;
    const result = await fc.check(
      property,
      parameters as fc.Parameters<
        [
          Iterable<
            fc.AsyncCommand<
              PropertyScenarioRunner<TSnapshot, TEvent>,
              undefined,
              false
            >
          >
        ]
      >
    );

    if (!result.failed) {
      return { runs: result.numRuns };
    }

    return {
      runs: result.numRuns,
      error:
        result.errorInstance ??
        new Error(
          result.interrupted
            ? 'FastCheck property run was interrupted'
            : 'FastCheck property run exhausted its precondition skips'
        ),
      replay: {
        engine: 'fast-check',
        seed: result.seed,
        path: result.counterexamplePath ?? undefined,
        replayPath: (
          result.counterexample?.[0] as { toString(): string } | undefined
        )
          ?.toString()
          .match(/replayPath="([^"]+)"/)?.[1]
      }
    };
  }
}

export function fastCheckAdapter(
  options: FastCheckAdapterOptions = {}
): PropertyTestAdapter<FastCheckGeneratorKind> {
  return new FastCheckAdapter(options);
}
