import {
  createActor,
  createMachine,
  getMicrosteps,
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

  it.each(['done', 'error', 'stopped'] as const)(
    'transition() treats every event as unhandled when the status is %s, like the actor',
    (status) => {
      const order = createMachine({
        initial: 'pending',
        on: {
          reopen: { target: '.pending' },
          fail: () => {
            throw new Error('payment provider down');
          }
        },
        states: {
          pending: {
            entry: (_, enq) => enq(() => {}),
            on: { pay: { target: 'paid' } }
          },
          paid: { type: 'final' }
        }
      });
      const actor = createActor(order);
      actor.subscribe({ error: () => {} });
      actor.start();
      if (status === 'done') actor.send({ type: 'pay' });
      if (status === 'error') actor.send({ type: 'fail' });
      if (status === 'stopped') actor.stop();
      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe(status);

      for (const type of ['pay', 'reopen', '@xstate.stop'] as const) {
        const event = { type } as any;
        const result = transition(order, snapshot, event);
        expect(isUnhandled(snapshot, result)).toBe(true);

        const microsteps = getMicrosteps(order, snapshot, event);
        expect(microsteps).toHaveLength(1);
        expect(microsteps[0][0]).toBe(snapshot);
        expect(microsteps[0][1]).toEqual([]);
        expect(microsteps[0][2]).toEqual([]);
      }

      actor.send({ type: 'reopen' });
      expect(actor.getSnapshot()).toBe(snapshot);
    }
  );

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
      (ev): ev is Extract<InspectionEvent, { type: '@xstate.transition' }> =>
        ev.type === '@xstate.transition' && ev.event.type === 'UNKNOWN'
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

  it('reports xstate.route events that match no routable state', () => {
    const onUnhandledEvent = vi.fn();
    const actor = createActor(
      createMachine({
        id: 'checkout',
        initial: 'cart',
        states: {
          cart: {},
          shipping: { id: 'shipping', route: {} },
          payment: { id: 'payment' }
        }
      }),
      { onUnhandledEvent }
    ).start();
    actor.send({ type: 'xstate.route', to: 'shipping' } as any);
    actor.send({ type: 'xstate.route', to: '#payment' } as any);
    actor.send({ type: 'xstate.route', to: '#shipping' });

    expect(actor.getSnapshot().value).toBe('shipping');
    expect(onUnhandledEvent.mock.calls.map(([event]) => event.to)).toEqual([
      'shipping',
      '#payment'
    ]);
    expect(warn.mock.calls).toEqual([
      [
        `Actor ${actor.id} received event "xstate.route" to "shipping" in state "cart" with no matching transition`
      ],
      [
        `Actor ${actor.id} received event "xstate.route" to "#payment" in state "cart" with no matching transition`
      ]
    ]);
  });
});
