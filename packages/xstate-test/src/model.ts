import type { ActorLogic, EventObject } from 'xstate';
import {
  replayTest,
  type TestFixture,
  type TestInvariant,
  type TestSut,
  type TestSutSession
} from './engine/propertyTest.ts';
import { planEdgePaths } from './engine/edgePaths.ts';
import { simpleStringify } from './engine/utils.ts';
import { testPaths } from './engine/testPaths.ts';

/** A pure specification of a system's legal inputs and observable behavior. @experimental */
export interface TestModel<TState, TEvent extends EventObject, TObservation> {
  readonly initial: () => TState;
  readonly choices: (state: TState) => readonly TEvent[];
  readonly step: (state: TState, event: TEvent) => TState;
  readonly observe: (state: TState) => TObservation;
  readonly check?: (state: TState) => void | Promise<void>;
}

/** A fresh system under test for one path or replay. @experimental */
export interface TestModelDriver<TEvent extends EventObject, TObservation> {
  readonly send: (event: TEvent) => void | Promise<void>;
  readonly read: () => TObservation | Promise<TObservation>;
  readonly settle?: () => void | Promise<void>;
  readonly dispose?: () => void | Promise<void>;
}

type DriverFactory<TEvent extends EventObject, TObservation> = () =>
  | TestModelDriver<TEvent, TObservation>
  | Promise<TestModelDriver<TEvent, TObservation>>;

type ModelSnapshot<TState> = {
  readonly status: 'active';
  readonly output: undefined;
  readonly error: undefined;
  readonly context: TState;
};

/** Explore or replay a standalone model with the existing test runner. @experimental */
export function createTestModel<
  TState,
  TEvent extends EventObject,
  TObservation
>(model: TestModel<TState, TEvent, TObservation>) {
  type SutFactory = DriverFactory<TEvent, TObservation>;
  type Snapshot = ModelSnapshot<TState>;

  const snapshot = (context: TState): Snapshot => ({
    status: 'active',
    output: undefined,
    error: undefined,
    context
  });
  const initial = () => snapshot(model.initial());
  const logic: ActorLogic<Snapshot, TEvent, undefined> = {
    getInitialSnapshot: initial,
    initialTransition: () => [initial(), []],
    transition: (current, event) => [
      snapshot(model.step(current.context, event)),
      []
    ],
    getPersistedSnapshot: (current) => current
  };

  const invariant: TestInvariant<Snapshot, TEvent> = ({ snapshot: current }) =>
    model.check?.(current.context);

  function adaptSut(create: SutFactory): TestSut<Snapshot, TEvent> {
    return {
      create: async () => {
        const driver = await create();
        const session: TestSutSession<Snapshot, TEvent> = {
          send: (event) => driver.send(event),
          read: () => driver.read(),
          settle: () => driver.settle?.(),
          dispose: () => driver.dispose?.()
        };
        return session;
      },
      projectModel: (current) => model.observe(current.context)
    };
  }

  return {
    /** Exercises each exact choice from one shortest prefix to its source state. */
    async test({
      sut,
      limit = 10_000
    }: { sut?: SutFactory; limit?: number } = {}) {
      return testPaths(logic, {
        paths: planEdgePaths(initial(), {
          events: (current) => model.choices(current.context),
          resolveStep: (current, event) => ({
            kind: 'edge',
            state: snapshot(model.step(current.context, event))
          }),
          serializeState: simpleStringify,
          limit
        }),
        invariant,
        ...(sut ? { sut: adaptSut(sut) } : {})
      });
    },
    /** Replays the fixture's exact events against a fresh driver. */
    replay(
      fixture: TestFixture,
      { sut, expect }: { sut?: SutFactory; expect?: 'failure' | 'pass' } = {}
    ) {
      return replayTest(logic, fixture, {
        invariant,
        ...(expect ? { expect } : {}),
        ...(sut ? { sut: adaptSut(sut) } : {})
      });
    }
  };
}
