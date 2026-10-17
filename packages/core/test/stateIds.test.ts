import {
  createActor,
  createAsyncLogic,
  createMachine,
  createStepLogic,
  type AnyActor
} from '../src/index.ts';

const idle = createStepLogic({
  context: {},
  run: ({ context }) => ({ context })
});

function idsOf(machine: { idMap: Map<string, unknown> }) {
  return [...machine.idMap.keys()];
}

describe('implicit state ids', () => {
  it('are paths from the root without a machine id', () => {
    const machine = createMachine({
      initial: 'checkout',
      states: {
        checkout: { initial: 'payment', states: { payment: {} } },
        root: {}
      }
    });

    expect(machine.id).toBe('');
    expect(machine.root.id).toBe('');
    expect(idsOf(machine)).toEqual([
      '',
      'checkout',
      'checkout.payment',
      'root'
    ]);
  });

  it('are prefixed by the machine id', () => {
    const machine = createMachine({
      id: 'shop',
      initial: 'checkout',
      states: {
        checkout: { initial: 'payment', states: { payment: {} } },
        root: {}
      }
    });

    expect(idsOf(machine)).toEqual([
      'shop',
      'shop.checkout',
      'shop.checkout.payment',
      'shop.root'
    ]);
  });

  it('keep parallel regions with the same leaf name apart', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        a: { initial: 'x', states: { x: {} } },
        b: { initial: 'x', states: { x: {} } }
      }
    });

    expect(idsOf(machine)).toEqual(['', 'a', 'a.x', 'b', 'b.x']);
  });

  it('lose to explicit ids', () => {
    const machine = createMachine({
      initial: 'a',
      states: { a: { id: 'first', states: { b: {} }, initial: 'b' } }
    });

    expect(idsOf(machine)).toEqual(['', 'first', 'a.b']);
  });

  it('reject an explicit id that collides with an implicit id', () => {
    expect(() =>
      createMachine({
        initial: 'checkout',
        states: { checkout: {}, other: { id: 'checkout' } }
      })
    ).toThrow(
      "Duplicate state id 'checkout': the states at 'checkout' and 'other' both have it. State ids must be unique; rename the explicit `id`."
    );
  });

  it('are matched and targeted by `#id`', () => {
    // Authored `#` targets are only type-checked against explicit ids.
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: { on: { GO: { target: '#checkout.payment' as never } } },
        checkout: { initial: 'cart', states: { cart: {}, payment: {} } }
      }
    });
    const actor = createActor(machine).start();

    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().value).toEqual({ checkout: 'payment' });
    expect(actor.getSnapshot().matches('#checkout.payment')).toBe(true);
    expect(actor.getSnapshot().matches('#checkout')).toBe(true);
  });

  it('target the root of a machine with an id by `#id`', () => {
    const machine = createMachine({
      id: 'shop',
      initial: 'a',
      states: {
        a: { on: { RESET: { target: '#shop', reenter: true } } }
      }
    });
    const actor = createActor(machine).start();

    actor.send({ type: 'RESET' });

    expect(actor.getSnapshot().matches('#shop')).toBe(true);
  });

  it('cannot reference the root of a machine without an id', () => {
    const machine = createMachine({ initial: 'a', states: { a: {} } });

    expect(() => machine.getStateNodeById('#')).toThrow(
      "State id '#' is empty: the root of a machine without an `id` cannot be referenced by id. Give the machine an `id` to reference its root as '#<id>'."
    );
  });
});

describe('implicit invoke ids', () => {
  it('are `<stateId>:<index>`', () => {
    const machine = createMachine({
      initial: 'upload',
      invoke: { src: idle },
      states: {
        upload: {
          initial: 'loading',
          invoke: [{ src: idle }, { src: idle }],
          states: { loading: { invoke: { src: idle } } }
        }
      }
    });

    expect(Object.keys(createActor(machine).getSnapshot().children)).toEqual([
      ':0',
      'upload:0',
      'upload:1',
      'upload.loading:0'
    ]);
  });

  it('start with the machine id', () => {
    const machine = createMachine({
      id: 'shop',
      initial: 'checkout',
      invoke: { src: idle },
      states: { checkout: { invoke: { src: idle } } }
    });

    expect(Object.keys(createActor(machine).getSnapshot().children)).toEqual([
      'shop:0',
      'shop.checkout:0'
    ]);
  });

  it('route completion events to the invoking state', () => {
    const machine = createMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: createAsyncLogic({ run: async () => 'done' }),
            onDone: { target: 'done' }
          }
        },
        done: {}
      }
    });

    return new Promise<void>((resolve) => {
      const actor = createActor(machine);
      actor.subscribe((snapshot) => {
        if (snapshot.matches('done')) resolve();
      });
      actor.start();
    });
  });

  it('are kept free when a registered source spawns under the same name', () => {
    const machine = createMachine({
      actors: { worker: idle },
      initial: 'worker',
      states: {
        worker: {
          invoke: { src: idle },
          on: {
            SPAWN: (_, enq) => {
              enq.spawn('worker');
            }
          }
        }
      }
    });
    const actor = createActor(machine).start();

    actor.send({ type: 'SPAWN' });

    expect(Object.keys(actor.getSnapshot().children).sort()).toEqual([
      'worker:0',
      'worker:1'
    ]);
  });

  it('leave anonymous spawned actors as `x:<n>`', () => {
    const machine = createMachine({
      entry: (_, enq) => {
        enq.spawn(idle);
      }
    });

    expect(Object.keys(createActor(machine).getSnapshot().children)).toEqual([
      'x:0'
    ]);
  });

  it('round-trip through persistence', () => {
    const machine = createMachine({
      initial: 'upload',
      states: {
        upload: {
          initial: 'loading',
          states: {
            loading: { invoke: { src: idle } },
            hist: { type: 'history', target: 'loading' }
          }
        }
      }
    });
    const actor = createActor(machine).start();
    const persisted = JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
    actor.stop();

    expect(Object.keys(persisted.children)).toEqual(['upload.loading:0']);

    const restored = createActor(machine, { snapshot: persisted }).start();
    const child = restored.getSnapshot().children[
      'upload.loading:0'
    ] as AnyActor;
    expect(child.getSnapshot().status).toBe('active');
    expect(restored.getSnapshot().matches('#upload.loading')).toBe(true);
  });
});
