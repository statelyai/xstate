import { SerializedState, serializeState, SimpleBehavior } from '@xstate/graph';
import {
  BaseActionObject,
  AnyEventObject,
  AnyState,
  AnyStateMachine,
  createMachine,
  EventFrom,
  EventObject,
  StateFrom,
  TypegenConstraint,
  TypegenDisabled,
  MachineContext
} from 'xstate';
import { TestModel } from './TestModel.js';
import {
  TestMachineConfig,
  TestMachineOptions,
  TestModelOptions
} from './types.js';
import { flatten, simpleStringify } from './utils.js';
import { validateMachine } from './validateMachine.js';

export async function testStateFromMeta(state: AnyState) {
  for (const id of Object.keys(state.meta)) {
    const stateNodeMeta = state.meta[id];
    if (typeof stateNodeMeta.test === 'function' && !stateNodeMeta.skip) {
      await stateNodeMeta.test(state);
    }
  }
}

export function createTestMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = AnyEventObject,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: TestMachineConfig<TContext, TEvent, TTypesMeta>,
  options?: TestMachineOptions<TContext, TEvent, TTypesMeta>
) {
  return createMachine(config, options as any);
}

export function executeAction(
  actionObject: BaseActionObject,
  state: AnyState
): void {
  // TODO: this is a hack, it doesn't correctly resolve actions
  // what gets passed as `action` here is probably also not correct
  if (typeof (actionObject as any)._exec === 'function') {
    (actionObject as any)._exec(state.context, state.event, {
      _event: state._event,
      action: actionObject,
      state
    });
  }
}

function serializeMachineTransition(
  state: AnyState,
  _event: AnyEventObject | undefined,
  prevState: AnyState | undefined,
  { serializeEvent }: { serializeEvent: (event: AnyEventObject) => string }
): string {
  // Only consider the transition via the serialized event if there actually
  // was a defined transition for the event
  if (!state.event || state.transitions.length === 0) {
    return '';
  }

  const prevStateString = prevState
    ? ` from ${simpleStringify(prevState.value)}`
    : '';

  return ` via ${serializeEvent(state.event)}${prevStateString}`;
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
  validateMachine(machine);

  const serializeEvent = options?.serializeEvent ?? simpleStringify;
  const serializeTransition =
    options?.serializeTransition ?? serializeMachineTransition;

  const testModel = new TestModel<StateFrom<TMachine>, EventFrom<TMachine>>(
    machine as SimpleBehavior<any, any>,
    {
      serializeState: (state, event, prevState) => {
        // Only consider the `state` if `serializeTransition()` is opted out (empty string)
        return `${serializeState(state)}${serializeTransition(
          state,
          event,
          prevState,
          {
            serializeEvent
          }
        )}` as SerializedState;
      },
      stateMatcher: (state, key) => {
        return key.startsWith('#')
          ? state.configuration.includes(machine.getStateNodeById(key))
          : state.matches(key);
      },
      execute: (state) => {
        state.actions.forEach((action) => {
          executeAction(action, state);
        });
      },
      getEvents: (state, eventCases) =>
        flatten(
          state.nextEvents.map((eventType) => {
            const eventCaseGenerator = eventCases?.[eventType];

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
      ...options
    }
  );

  return testModel;
}
