/**
 * Outcome stubs for executed-mode runs. Internal to `xstate/graph`: nothing
 * here is re-exported from the package entry point.
 */
import type { ActorLogic } from '../index.ts';
import { createAsyncLogic } from '../actors/promise.ts';
import type { TestActorOutcome, TestOutcomeRecord } from './propertyTest.ts';

/**
 * Queues and hands out actor outcomes for stubbed invoke sources.
 *
 * A stub actor asks the registry for its outcome when it starts. If an
 * outcome is already queued for its source it resolves immediately; otherwise
 * the stub stays pending until an `outcome` command (or a seeded replay
 * record) supplies one, which is what lets fast-check shrink service results.
 */
export class PropertyOutcomeRegistry {
  private queued = new Map<string, TestActorOutcome[]>();
  private waiting = new Map<string, ((outcome: TestActorOutcome) => void)[]>();

  /** Called by a stub actor when it starts. */
  public request(src: string): Promise<TestActorOutcome> {
    const queue = this.queued.get(src);
    const next = queue?.shift();
    if (next) {
      return Promise.resolve(next);
    }
    return new Promise<TestActorOutcome>((resolve) => {
      const waiters = this.waiting.get(src);
      if (waiters) {
        waiters.push(resolve);
      } else {
        this.waiting.set(src, [resolve]);
      }
    });
  }

  /** Resolves the oldest pending stub for `src`, or queues for the next one. */
  public provide(src: string, outcome: TestActorOutcome): void {
    const waiters = this.waiting.get(src);
    const waiter = waiters?.shift();
    if (waiter) {
      waiter(outcome);
      return;
    }
    const queue = this.queued.get(src);
    if (queue) {
      queue.push(outcome);
    } else {
      this.queued.set(src, [outcome]);
    }
  }

  /** Pre-loads recorded outcomes so a replay never calls a real service. */
  public seed(records: readonly TestOutcomeRecord[]): void {
    for (const record of records) {
      this.provide(record.src, record.outcome);
    }
  }

  public reset(): void {
    this.queued = new Map();
    this.waiting = new Map();
  }
}

let activeOutcomeRegistry: PropertyOutcomeRegistry | undefined;

/** Makes `registry` the one outcome stubs resolve from. */
export function setActiveOutcomeRegistry(
  registry: PropertyOutcomeRegistry
): void {
  activeOutcomeRegistry = registry;
}

/** Clears the active registry, if it is still `registry`. */
export function releaseActiveOutcomeRegistry(
  registry: PropertyOutcomeRegistry
): void {
  if (activeOutcomeRegistry === registry) {
    activeOutcomeRegistry = undefined;
  }
}

/**
 * Builds the stub {@link ActorLogic} that replaces an invoke source named
 * `src`. The registry is read when the stub starts — always inside the
 * owning runner's step — so one stub built per campaign serves every run.
 */
export function createOutcomeStub(src: string): ActorLogic<any, any, any> {
  return createAsyncLogic({
    run: async () => {
      const registry = activeOutcomeRegistry;
      if (!registry) {
        throw new Error(
          `Property outcome stub for "${src}" ran outside an executed-mode property run`
        );
      }
      const outcome = await registry.request(src);
      if (outcome.ok) {
        return outcome.output;
      }
      // The error is rejected as-is, so the machine's `onError` sees the same
      // value a pure-mode run sends in its `xstate.error.actor` event.
      throw outcome.error;
    }
  }) as unknown as ActorLogic<any, any, any>;
}

/** Applies `actors` to a machine, rejecting logic that cannot be provided. */
export function provideActors<TLogic>(
  logic: TLogic,
  actors: Readonly<Record<string, ActorLogic<any, any, any>>>
): TLogic {
  const provide = (logic as { provide?: unknown }).provide;
  if (typeof provide !== 'function') {
    throw new Error(
      'Property `actors` and `outcomes` require a state machine; the provided actor logic has no `provide()`'
    );
  }
  return (provide as (sources: unknown) => TLogic).call(logic, { actors });
}
