import {
  createFSM,
  createMachine,
  initialTransition,
  transition
} from '../src';

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

function projectSnapshot(snapshot: {
  status: string;
  value: unknown;
  context: unknown;
  output: unknown;
  error: unknown;
}) {
  return {
    status: snapshot.status,
    value: snapshot.value,
    context: snapshot.context,
    output: snapshot.output,
    error: snapshot.error
  };
}

describe('createFSM differential behavior', () => {
  it('matches equivalent flat createMachine transitions for event sequences', () => {
    const fsm = createFSM<{}, ToggleEvent>({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            toggle: { target: 'active' }
          }
        },
        active: {
          on: {
            toggle: { target: 'inactive' },
            reset: { target: 'inactive' }
          }
        }
      }
    });
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            toggle: { target: 'active' }
          }
        },
        active: {
          on: {
            toggle: { target: 'inactive' },
            reset: { target: 'inactive' }
          }
        }
      }
    });

    for (const events of eventSequences<ToggleEvent>(
      [{ type: 'toggle' }, { type: 'reset' }, { type: 'unknown' }],
      5
    )) {
      let [fsmSnapshot] = initialTransition(fsm);
      let [machineSnapshot] = initialTransition(machine);

      for (const event of events) {
        [fsmSnapshot] = transition(fsm, fsmSnapshot, event);
        [machineSnapshot] = transition(machine, machineSnapshot, event);
      }

      expect(projectSnapshot(fsmSnapshot)).toEqual(
        projectSnapshot(machineSnapshot)
      );
    }
  });

  it('matches guarded context updates across generated event sequences', () => {
    type Event = { type: 'increment'; accepted: boolean } | { type: 'reset' };
    const config = {
      initial: 'active',
      context: { count: 0 },
      states: {
        active: {
          on: {
            increment: [
              {
                guard: ({ event }: any) => event.accepted,
                context: ({ context }: any) => ({ count: context.count + 1 })
              },
              {}
            ],
            reset: { context: { count: 0 } }
          }
        }
      }
    };
    const fsm = createFSM<{ count: number }, Event>(config);
    const machine = createMachine(config);

    for (const events of eventSequences<Event>(
      [
        { type: 'increment', accepted: true },
        { type: 'increment', accepted: false },
        { type: 'reset' }
      ],
      4
    )) {
      let [fsmSnapshot] = initialTransition(fsm);
      let [machineSnapshot] = initialTransition(machine);
      for (const event of events) {
        [fsmSnapshot] = transition(fsm, fsmSnapshot, event);
        [machineSnapshot] = transition(machine, machineSnapshot, event);
      }
      expect(projectSnapshot(fsmSnapshot)).toEqual(
        projectSnapshot(machineSnapshot)
      );
    }
  });

  it('matches eventless stabilization and final completion', () => {
    const config = {
      initial: 'checking',
      context: { ready: true },
      states: {
        checking: {
          always: [
            {
              guard: ({ context }: any) => context.ready,
              target: 'ready'
            },
            { target: 'blocked' }
          ]
        },
        blocked: {},
        ready: { on: { finish: { target: 'done' } } },
        done: { type: 'final' as const }
      }
    };
    const fsm = createFSM(config);
    const machine = createMachine(config);
    let [fsmSnapshot] = initialTransition(fsm);
    let [machineSnapshot] = initialTransition(machine);

    expect(projectSnapshot(fsmSnapshot)).toEqual(
      projectSnapshot(machineSnapshot)
    );

    [fsmSnapshot] = transition(fsm, fsmSnapshot, { type: 'finish' });
    [machineSnapshot] = transition(machine, machineSnapshot, {
      type: 'finish'
    });
    expect(projectSnapshot(fsmSnapshot)).toEqual(
      projectSnapshot(machineSnapshot)
    );
  });
});
