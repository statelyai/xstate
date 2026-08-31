import { createFSM } from '../src/fsm.ts';
import { createMachine } from '../src/createMachine.ts';
import { initialTransition, transition } from '../src/transition.ts';

type ToggleEvent = { type: 'toggle' } | { type: 'reset' } | { type: 'unknown' };

function eventSequences<TEvent>(events: readonly TEvent[], maxLength: number) {
  const sequences: TEvent[][] = [[]];
  for (let length = 1; length <= maxLength; length++) {
    const previous = sequences.filter(
      (sequence) => sequence.length === length - 1
    );
    for (const sequence of previous) {
      for (const event of events) {
        sequences.push([...sequence, event]);
      }
    }
  }
  return sequences;
}

describe('createFSM differential behavior', () => {
  it('matches equivalent flat createMachine transitions', () => {
    const config = {
      initial: 'inactive' as const,
      states: {
        inactive: { on: { toggle: { target: 'active' } } },
        active: {
          on: {
            toggle: { target: 'inactive' },
            reset: { target: 'inactive' }
          }
        }
      }
    };
    const fsm = createFSM<{}, ToggleEvent>(config);
    const machine = createMachine(config);

    for (const events of eventSequences<ToggleEvent>(
      [{ type: 'toggle' }, { type: 'reset' }, { type: 'unknown' }],
      5
    )) {
      let fsmSnapshot = fsm.initialState;
      let [machineSnapshot] = initialTransition(machine);

      for (const event of events) {
        fsmSnapshot = fsm.transition(fsmSnapshot, event);
        [machineSnapshot] = transition(machine, machineSnapshot, event);
      }

      expect(fsmSnapshot).toEqual({
        value: machineSnapshot.value,
        context: machineSnapshot.context
      });
    }
  });

  it('matches pure context updates', () => {
    type Event = { type: 'increment'; by: number } | { type: 'reset' };
    const config = {
      initial: 'active' as const,
      context: { count: 0 },
      states: {
        active: {
          on: {
            increment: ({
              context,
              event
            }: {
              context: { count: number };
              event: Extract<Event, { type: 'increment' }>;
            }) => ({
              context: { count: context.count + event.by }
            }),
            reset: { context: { count: 0 } }
          }
        }
      }
    };
    const fsm = createFSM<{ count: number }, Event>(config);
    const machine = createMachine(config);

    for (const events of eventSequences<Event>(
      [
        { type: 'increment', by: 1 },
        { type: 'increment', by: 2 },
        { type: 'reset' }
      ],
      4
    )) {
      let fsmSnapshot = fsm.initialState;
      let [machineSnapshot] = initialTransition(machine);

      for (const event of events) {
        fsmSnapshot = fsm.transition(fsmSnapshot, event);
        [machineSnapshot] = transition(machine, machineSnapshot, event);
      }

      expect(fsmSnapshot).toEqual({
        value: machineSnapshot.value,
        context: machineSnapshot.context
      });
    }
  });
});
