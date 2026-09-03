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

class EventPropertyCommand<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> implements fc.AsyncCommand<
  PropertyScenarioRunner<TSnapshot, TEvent>,
  undefined,
  false
> {
  public constructor(
    public readonly type: string,
    public readonly generated: unknown,
    public readonly caseId: string
  ) {}

  public check(
    runner: Readonly<PropertyScenarioRunner<TSnapshot, TEvent>>
  ): boolean {
    return runner.canRunGenerated(this.type, this.generated, this.caseId);
  }

  public async run(
    runner: PropertyScenarioRunner<TSnapshot, TEvent>
  ): Promise<void> {
    await runner.runGenerated(this.type, this.generated, this.caseId);
  }

  public toString(): string {
    return `${this.type}(${JSON.stringify(this.generated)})`;
  }
}

class AdvancePropertyCommand<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> implements fc.AsyncCommand<
  PropertyScenarioRunner<TSnapshot, TEvent>,
  undefined,
  false
> {
  public constructor(public readonly milliseconds: number) {}

  public check(runner: PropertyScenarioRunner<TSnapshot, TEvent>): boolean {
    return runner.canRunCommand(runner.getSnapshot().status === 'active');
  }

  public async run(
    runner: PropertyScenarioRunner<TSnapshot, TEvent>
  ): Promise<void> {
    await runner.advance(this.milliseconds);
  }

  public toString(): string {
    return `advance(${this.milliseconds})`;
  }
}

class CheckpointPropertyCommand<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> implements fc.AsyncCommand<
  PropertyScenarioRunner<TSnapshot, TEvent>,
  undefined,
  false
> {
  public constructor(public readonly label?: string) {}

  public check(runner: PropertyScenarioRunner<TSnapshot, TEvent>): boolean {
    return runner.canRunCommand(true);
  }

  public async run(
    runner: PropertyScenarioRunner<TSnapshot, TEvent>
  ): Promise<void> {
    await runner.checkpoint(this.label);
  }

  public toString(): string {
    return `checkpoint(${JSON.stringify(this.label)})`;
  }
}

class StopPropertyCommand<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
> implements fc.AsyncCommand<
  PropertyScenarioRunner<TSnapshot, TEvent>,
  undefined,
  false
> {
  public check(runner: PropertyScenarioRunner<TSnapshot, TEvent>): boolean {
    return runner.canRunCommand(runner.getSnapshot().status === 'active');
  }

  public async run(
    runner: PropertyScenarioRunner<TSnapshot, TEvent>
  ): Promise<void> {
    await runner.stop();
  }

  public toString(): string {
    return 'stop()';
  }
}

class FastCheckAdapter implements PropertyTestAdapter<FastCheckGeneratorKind> {
  public readonly kind?: FastCheckGeneratorKind;

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
    >[] = request.events.map(({ type, caseId, generator }) =>
      (generator as fc.Arbitrary<unknown>).map(
        (generated) => new EventPropertyCommand(type, generated, caseId)
      )
    );
    for (const command of request.commands) {
      if (command.type === 'advance') {
        commands.push(
          (command.generator as fc.Arbitrary<number>).map(
            (milliseconds) => new AdvancePropertyCommand(milliseconds)
          )
        );
      } else if (command.type === 'checkpoint') {
        commands.push(
          (command.generator as fc.Arbitrary<{ readonly label?: string }>).map(
            (value) => new CheckpointPropertyCommand(value.label)
          )
        );
      } else {
        commands.push(
          (command.generator as fc.Arbitrary<Record<string, never>>).map(
            () => new StopPropertyCommand()
          )
        );
      }
    }
    if (!commands.length) {
      throw new Error(
        'Property tests require at least one event or command generator'
      );
    }
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
      try {
        await runner.start();
        await fc.asyncModelRun(
          () => ({ model: runner, real: undefined }),
          generated
        );
        runner.finish();
      } finally {
        await runner.dispose();
      }
    });
    const { maxCommands: _, replayPath: __, ...parameters } = this.options;
    if (request.runBudget !== undefined) {
      parameters.numRuns = request.runBudget;
    }
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

    const configuredRuns = result.runConfiguration.numRuns ?? 100;
    const truncationReasons: string[] = [];
    if (result.interrupted) {
      truncationReasons.push('adapter run interrupted');
    }
    if (result.failed && result.numRuns < configuredRuns) {
      truncationReasons.push(
        result.errorInstance
          ? 'counterexample found before configured runs completed'
          : 'precondition skips exhausted before configured runs completed'
      );
    }
    const exploration = {
      configuredRuns,
      maximumSequenceLength: this.options.maxCommands ?? null,
      engine: 'fast-check',
      seed: result.seed,
      path: result.counterexamplePath ?? undefined,
      truncated: truncationReasons.length > 0,
      truncationReasons
    };

    if (!result.failed) {
      return { runs: result.numRuns, exploration };
    }

    return {
      runs: result.numRuns,
      exploration,
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
