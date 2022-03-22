import { SimpleBehavior, serializeState } from '@xstate/graph';
import type {
  ActionObject,
  AnyState,
  AnyStateMachine,
  EventFrom,
  StateFrom
} from 'xstate';
import { flatten } from '.';
import { TestModel } from './TestModel';
import { TestModelOptions, TestEventConfig } from './types';

export async function testMachineState(state: AnyState, testContext: any) {
  for (const id of Object.keys(state.meta)) {
    const stateNodeMeta = state.meta[id];
    if (typeof stateNodeMeta.test === 'function' && !stateNodeMeta.skip) {
      await stateNodeMeta.test(testContext, state);
    }
  }
}

export function executeAction(
  actionObject: ActionObject<any, any>,
  state: AnyState
): void {
  if (typeof actionObject.exec === 'function') {
    actionObject.exec(state.context, state.event, {
      _event: state._event,
      action: actionObject,
      state
    });
  }
}

/**
 * Creates a test model that represents an abstract model of a
 * system under test (SUT).
 *
 * The test model is used to generate test plans, which are used to
 * verify that states in the `machine` are reachable in the SUT.
 *
 * @example
 *
 * ```js
 * const toggleModel = createModel(toggleMachine).withEvents({
 *   TOGGLE: {
 *     exec: async page => {
 *       await page.click('input');
 *     }
 *   }
 * });
 * ```
 *
 * @param machine The state machine used to represent the abstract model.
 * @param options Options for the created test model:
 * - `events`: an object mapping string event types (e.g., `SUBMIT`)
 * to an event test config (e.g., `{exec: () => {...}, cases: [...]}`)
 */
export function createTestModel<
  TMachine extends AnyStateMachine,
  TestContext = any
>(
  machine: TMachine,
  options?: Partial<
    TestModelOptions<StateFrom<TMachine>, EventFrom<TMachine>, TestContext>
  >
): TestModel<StateFrom<TMachine>, EventFrom<TMachine>, TestContext> {
  const testModel = new TestModel<
    StateFrom<TMachine>,
    EventFrom<TMachine>,
    TestContext
  >(machine as SimpleBehavior<any, any>, {
    serializeState,
    testState: testMachineState,
    execute: (state) => {
      state.actions.forEach((action) => {
        executeAction(action, state);
      });
    },
    getEvents: (state) =>
      flatten(
        state.nextEvents.map((eventType) => {
          const eventCaseGenerator = options?.events?.[eventType]?.cases;

          return (
            // Use generated events or a plain event without payload
            (
              eventCaseGenerator?.() ?? [
                { type: eventType } as EventFrom<TMachine>
              ]
            ).map((e) => ({ type: eventType, ...e }))
          );
        })
      ),
    testTransition: async (step, testContext) => {
      // TODO: fix types
      const eventConfig = options?.events?.[
        (step.event as any).type
      ] as TestEventConfig<any>;

      await eventConfig?.exec?.(step as any, testContext);
    },
    ...options
  });

  return testModel;
}
