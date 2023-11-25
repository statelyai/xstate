import { SerializedState, serializeState, SimpleBehavior } from '@xstate/graph';
import {
  AnyEventObject,
  AnyState,
  AnyStateMachine,
  createMachine,
  EventFrom,
  EventObject,
  StateFrom,
  TypegenConstraint,
  TypegenDisabled
} from 'xstate';
import { TestModel } from './TestModel';
import {
  TestMachineConfig,
  TestMachineOptions,
  TestModelOptions
} from './types';
import { flatten, simpleStringify } from './utils';
import { validateMachine } from './validateMachine';

export async function testStateFromMeta(state: AnyState) {
  for (const id of Object.keys(state.meta)) {
    const stateNodeMeta = state.meta[id];
    if (typeof stateNodeMeta.test === 'function' && !stateNodeMeta.skip) {
      await stateNodeMeta.test(state);
    }
  }
}

export function createTestMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: TestMachineConfig<TContext, TEvent, TTypesMeta>,
  options?: TestMachineOptions<TContext, TEvent, TTypesMeta>
) {
  return createMachine(config, options as any);
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
 * The test model is used to generate test paths, which are used to
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
  const { events: getEvents, ...otherOptions } = options ?? {};

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
      events: (state) => {
        const events =
          typeof getEvents === 'function' ? getEvents(state) : getEvents ?? [];

        return flatten(
          state.nextEvents.map((eventType) => {
            // @ts-ignore
            if (events.some((e) => e.type === eventType)) {
              // @ts-ignore
              return events.filter((e) => e.type === eventType);
            }

            return [{ type: eventType } as any]; // TODO: fix types
          })
        );
      },
      ...otherOptions
    }
  );

  return testModel;
}
