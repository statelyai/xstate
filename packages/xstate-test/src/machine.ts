import { SerializedState, serializeState } from '@xstate/graph';
import {
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateMachine,
  createMachine,
  EventFrom,
  EventObject,
  TypegenConstraint,
  TypegenDisabled,
  MachineContext,
  StateValue,
  SnapshotFrom,
  MachineSnapshot,
  __unsafe_getAllOwnEventDescriptors,
  AnyActorRef
} from 'xstate';
import { TestModel } from './TestModel.ts';
import {
  TestMachineConfig,
  TestMachineOptions,
  TestModelOptions
} from './types.ts';
import { simpleStringify } from './utils.ts';
import { validateMachine } from './validateMachine.ts';

export async function testStateFromMeta(snapshot: AnyMachineSnapshot) {
  const meta = snapshot.getMeta();
  for (const id of Object.keys(meta)) {
    const stateNodeMeta = meta[id];
    if (typeof stateNodeMeta.test === 'function' && !stateNodeMeta.skip) {
      await stateNodeMeta.test(snapshot);
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
  return createMachine(config as any, options as any);
}

function stateValuesEqual(
  a: StateValue | undefined,
  b: StateValue | undefined
): boolean {
  if (a === b) {
    return true;
  }

  if (a === undefined || b === undefined) {
    return false;
  }

  if (typeof a === 'string' || typeof b === 'string') {
    return a === b;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => stateValuesEqual(a[key], b[key]))
  );
}

function serializeMachineTransition(
  snapshot: MachineSnapshot<
    MachineContext,
    EventObject,
    Record<string, AnyActorRef | undefined>,
    StateValue,
    string,
    unknown
  >,
  event: AnyEventObject | undefined,
  previousSnapshot:
    | MachineSnapshot<
        MachineContext,
        EventObject,
        Record<string, AnyActorRef | undefined>,
        StateValue,
        string,
        unknown
      >
    | undefined,
  { serializeEvent }: { serializeEvent: (event: AnyEventObject) => string }
): string {
  // TODO: the stateValuesEqual check here is very likely not exactly correct
  // but I'm not sure what the correct check is and what this is trying to do
  if (
    !event ||
    (previousSnapshot &&
      stateValuesEqual(previousSnapshot.value, snapshot.value))
  ) {
    return '';
  }

  const prevStateString = previousSnapshot
    ? ` from ${simpleStringify(previousSnapshot.value)}`
    : '';

  return ` via ${serializeEvent(event)}${prevStateString}`;
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
  options?: Partial<
    TestModelOptions<SnapshotFrom<TMachine>, EventFrom<TMachine>>
  >
): TestModel<SnapshotFrom<TMachine>, EventFrom<TMachine>, unknown> {
  validateMachine(machine);

  const serializeEvent = (options?.serializeEvent ?? simpleStringify) as (
    event: AnyEventObject
  ) => string;
  const serializeTransition =
    options?.serializeTransition ?? serializeMachineTransition;
  const { events: getEvents, ...otherOptions } = options ?? {};

  const testModel = new TestModel<
    SnapshotFrom<TMachine>,
    EventFrom<TMachine>,
    unknown
  >(machine as any, {
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
        ? (state as any)._nodes.includes(machine.getStateNodeById(key))
        : (state as any).matches(key);
    },
    events: (state) => {
      const events =
        typeof getEvents === 'function' ? getEvents(state) : getEvents ?? [];

      return __unsafe_getAllOwnEventDescriptors(state).flatMap(
        (eventType: string) => {
          if (events.some((e) => (e as EventObject).type === eventType)) {
            return events.filter((e) => (e as EventObject).type === eventType);
          }

          return [{ type: eventType } as any]; // TODO: fix types
        }
      );
    },
    ...otherOptions
  });

  return testModel;
}
