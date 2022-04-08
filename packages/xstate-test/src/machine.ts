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
import { TestModelEventConfig, TestModelOptions, EventExecutor } from './types';

export async function testStateFromMeta(state: AnyState) {
  for (const id of Object.keys(state.meta)) {
    const stateNodeMeta = state.meta[id];
    if (typeof stateNodeMeta.test === 'function' && !stateNodeMeta.skip) {
      await stateNodeMeta.test(state);
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
export function createTestModel<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: Partial<TestModelOptions<StateFrom<TMachine>, EventFrom<TMachine>>>
): TestModel<StateFrom<TMachine>, EventFrom<TMachine>> {
  const testModel = new TestModel<StateFrom<TMachine>, EventFrom<TMachine>>(
    machine as SimpleBehavior<any, any>,
    {
      serializeState,
      stateMatcher: (state, key) => {
        return key.startsWith('#')
          ? state.configuration.includes(machine.getStateNodeById(key))
          : state.matches(key);
      },
      states: {
        '*': testStateFromMeta
      },
      execute: (state) => {
        state.actions.forEach((action) => {
          executeAction(action, state);
        });
      },
      getEvents: (state) =>
        flatten(
          state.nextEvents.map((eventType) => {
            const eventConfig = options?.events?.[eventType];
            const eventCaseGenerator =
              typeof eventConfig === 'function'
                ? undefined
                : (eventConfig?.cases as TestModelEventConfig<
                    any,
                    any
                  >['cases']);

            const cases = eventCaseGenerator
              ? Array.isArray(eventCaseGenerator)
                ? eventCaseGenerator
                : eventCaseGenerator(state)
              : [{ type: eventType }];

            return (
              // Use generated events or a plain event without payload
              cases.map((e) => {
                return { type: eventType, ...(e as any) };
              })
            );
          })
        ),
      testTransition: async (step) => {
        const eventConfig =
          testModel.options.events?.[
            (step.event as any).type as EventFrom<TMachine>['type']
          ];

        const eventExec =
          typeof eventConfig === 'function' ? eventConfig : eventConfig?.exec;

        await (eventExec as EventExecutor<
          StateFrom<TMachine>,
          EventFrom<TMachine>
        >)?.(step);
      },
      ...options
    }
  );

  return testModel;
}
