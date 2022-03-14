import { serializeState, SimpleBehavior } from '@xstate/graph';
import {
  EventObject,
  State,
  StateFrom,
  EventFrom,
  AnyStateMachine,
  ActionObject,
  AnyState
} from 'xstate';
import { TestModel } from './TestModel';
import { TestModelOptions, TestEventsConfig } from './types';

export function getEventSamples<TEvent extends EventObject>(
  eventsOptions: TestEventsConfig<any>
): TEvent[] {
  const result: TEvent[] = [];

  Object.keys(eventsOptions).forEach((key) => {
    const eventConfig = eventsOptions[key];
    if (typeof eventConfig === 'function') {
      result.push({
        type: key
      } as any);
      return;
    }

    const events = eventConfig.cases
      ? eventConfig.cases.map((sample) => ({
          type: key,
          ...sample
        }))
      : [
          {
            type: key
          }
        ];

    result.push(...(events as any[]));
  });

  return result;
}

async function assertState(state: State<any, any, any>, testContext: any) {
  for (const id of Object.keys(state.meta)) {
    const stateNodeMeta = state.meta[id];
    if (typeof stateNodeMeta.test === 'function' && !stateNodeMeta.skip) {
      // this.coverage.stateNodes.set(
      //   id,
      //   (this.coverage.stateNodes.get(id) || 0) + 1
      // );

      await stateNodeMeta.test(testContext, state);
    }
  }
}

function executeAction(
  actionObject: ActionObject<any, any>,
  state: AnyState
): void {
  if (typeof actionObject.exec == 'function') {
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
    testState: assertState,
    execute: (state) => {
      state.actions.forEach((action) => {
        executeAction(action, state);
      });
    },
    getEvents: (state) =>
      state.nextEvents.map(
        (eventType) => ({ type: eventType } as EventFrom<TMachine>)
      ),
    ...options
  });

  return testModel;
}
