import {
  createActor,
  createMachine,
  initialTransition,
  isUnhandled,
  transition,
  type InspectionEvent
} from '../src/index.ts';

const machine = createMachine({
  id: 'toggle',
  initial: 'a',
  states: {
    a: {
      on: {
        NOOP: () => ({}),
        NEXT: { target: 'b' }
      }
    },
    b: {}
  }
});

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe('unhandled events', () => {
  it('transition() returns the same snapshot reference and no effects for an unhandled event', () => {
    const [snapshot] = initialTransition(machine);
    const result = transition(machine, snapshot, { type: 'UNKNOWN' } as any);

    expect(result[0]).toBe(snapshot);
    expect(result[1]).toEqual([]);
    expect(isUnhandled(snapshot, result)).toBe(true);
  });

  it('transition() returns a new snapshot object for a handled event that changes nothing', () => {
    const [snapshot] = initialTransition(machine);
    const result = transition(machine, snapshot, { type: 'NOOP' });

    expect(result[0]).not.toBe(snapshot);
    expect(result[0].value).toBe('a');
    expect(isUnhandled(snapshot, result)).toBe(false);
  });

  it('calls onUnhandledEvent with the event and unchanged snapshot', () => {
    const onUnhandledEvent = vi.fn();
    const actor = createActor(machine, { onUnhandledEvent }).start();
    const snapshot = actor.getSnapshot();
    actor.send({ type: 'UNKNOWN' } as any);

    expect(onUnhandledEvent).toHaveBeenCalledExactlyOnceWith(
      { type: 'UNKNOWN' },
      snapshot
    );
    expect(actor.getSnapshot()).toBe(snapshot);
  });

  it('shows an unhandled event in the inspection stream as a transition with the same snapshot', () => {
    const events: InspectionEvent[] = [];
    const actor = createActor(machine, {
      inspect: (ev) => {
        events.push(ev);
      }
    }).start();
    const before = actor.getSnapshot();
    actor.send({ type: 'UNKNOWN' } as any);

    const transitions = events.filter(
      (ev) => ev.type === '@xstate.transition' && ev.event.type === 'UNKNOWN'
    );
    expect(transitions).toHaveLength(1);
    expect(transitions[0].snapshot).toBe(before);
    expect(events.some((ev) => (ev.type as string).includes('unhandled'))).toBe(
      false
    );
  });

  it('warns once per event type per actor in development', () => {
    const actor = createActor(machine).start();
    actor.send({ type: 'UNKNOWN' } as any);
    actor.send({ type: 'UNKNOWN' } as any);

    expect(warn.mock.calls).toEqual([
      [
        `Actor ${actor.id} received event "UNKNOWN" in state "a" with no matching transition`
      ]
    ]);
  });

  it('does not report handled, wildcard-matched or internal xstate.* events', () => {
    const onUnhandledEvent = vi.fn();
    const actor = createActor(
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              NOOP: () => ({}),
              'wild.*': () => ({})
            }
          }
        }
      }),
      { onUnhandledEvent }
    ).start();
    actor.send({ type: 'NOOP' });
    actor.send({ type: 'wild.card' } as any);
    actor.send({ type: 'xstate.snapshot.actor' } as any);

    expect(onUnhandledEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
