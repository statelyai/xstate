import { deliverEvent, setup } from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';

const workerMachine = setup({}).createMachine({
  id: 'worker',
  initial: 'idle',
  states: {
    idle: {
      on: {
        PING: ({ parent }, enq) => {
          enq.sendTo(parent, { type: 'WORKER.READY' });
          return { target: 'ready' };
        }
      }
    },
    ready: {}
  }
});

const orderMachine = setup({
  actors: { worker: workerMachine }
}).createMachine({
  id: 'order',
  initial: 'starting',
  entry: ({ actors }, enq) => {
    enq.spawn(actors.worker);
  },
  states: {
    starting: {
      on: {
        KICK: ({ children }, enq) => {
          enq.sendTo(children['worker:0'], { type: 'PING' });
        },
        'WORKER.READY': { target: 'done' }
      }
    },
    done: { type: 'final' }
  }
});

describe('durable execution with only systemRuntime', () => {
  it('executes spawn effects without a per-effect runtime', async () => {
    const operations: string[] = [];
    const rootEvents: unknown[] = [];
    const durable = createDurable(orderMachine, {
      executeAction: async (action) => {
        operations.push(`action:${action.type}`);
      },
      systemRuntime: {
        spawnActor: (_source, actor) => {
          operations.push(`spawn:${actor.address}`);
        },
        startActor: (actor) => {
          operations.push(`start:${actor.address}`);
          actor.start();
        },
        sendEvent: (source, target, event) => {
          operations.push(
            `send:${source?.address}->${target.address}:${event.type}`
          );
          if (target.address === durable.rootAddress) {
            rootEvents.push(event);
          } else {
            deliverEvent(source, target, event);
          }
        }
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    let [snapshot, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    expect(operations).toEqual([
      'spawn:order/worker:0',
      'start:order/worker:0'
    ]);

    [snapshot, effects] = durable.transition(snapshot, { type: 'KICK' });
    await durable.executeEffects(effects);
    // The child's reply routed through the system runtime with no
    // per-actor wiring.
    expect(operations).toContain('send:order/worker:0->order:WORKER.READY');
    expect(rootEvents).toEqual([{ type: 'WORKER.READY' }]);

    [snapshot] = durable.transition(
      snapshot,
      rootEvents[0] as { type: 'WORKER.READY' }
    );
    expect(snapshot.status).toBe('done');
  });
});

describe('durable effect descriptors', () => {
  it('tags every effect with a JSON-safe descriptor', () => {
    const durable = createDurable(orderMachine, {
      executeAction: () => {},
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });

    const [, effects] = durable.initialTransition();
    for (const { descriptor } of effects) {
      expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor);
    }
    expect(effects.map(({ descriptor }) => descriptor.type)).toEqual([
      '@xstate.spawn',
      '@xstate.start'
    ]);
    const spawn = effects.find(
      ({ descriptor }) => descriptor.type === '@xstate.spawn'
    )!.descriptor;
    expect(spawn).toMatchObject({
      actor: 'order/worker:0',
      src: 'worker'
    });
  });
});

describe('durable rootAddress', () => {
  it('is the logic name, known before any transition', () => {
    const durable = createDurable(orderMachine, {
      executeAction: () => {},
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });
    expect(durable.rootAddress).toBe('order');
    const [snapshot] = durable.initialTransition();
    expect(durable.getActorRef(snapshot)?.address).toBe(durable.rootAddress);
  });
});
