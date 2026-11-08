import { createAsyncLogic, createMachine, setup } from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';
import type { InspectionEvent } from '../src/inspection.ts';

const fraudCheck = createAsyncLogic({
  id: 'fraudCheck',
  run: async () => 0.2
});

const machine = setup({ actors: { fraudCheck } }).createMachine({
  id: 'order',
  initial: 'verifying',
  states: {
    verifying: {
      invoke: { id: 'fraud', src: 'fraudCheck', onDone: { target: 'approved' } }
    },
    approved: {}
  }
});

describe('durable execution inspection', () => {
  it('keeps an announced actor reference readable after materialization', async () => {
    const inspected: InspectionEvent[] = [];
    const counter = createMachine({
      context: { count: 0 },
      on: {
        TICK: ({ context, self }) => ({
          context: { count: context.count + Number(Boolean(self.id)) }
        })
      }
    });
    const durable = createDurable(
      counter,
      {
        executeAction: () => {},
        waitForEvent: () => {
          throw new Error('host-driven loop');
        }
      },
      { inspect: (event) => inspected.push(event) }
    );
    let [snapshot, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    const initialAnnouncement = inspected.findLast(
      (event) => event.type === '@xstate.actor'
    );
    expect(initialAnnouncement).toBeDefined();
    expect(initialAnnouncement!.actorRef.getSnapshot()).toBe(snapshot);

    [snapshot, effects] = durable.transition(snapshot, { type: 'TICK' });
    await durable.executeEffects(effects);

    const announcement = inspected.findLast(
      (event) => event.type === '@xstate.actor'
    );
    expect(announcement).toBeDefined();
    expect(announcement!.actorRef.getSnapshot()).toBe(snapshot);
  });

  it('the inspect option observes the whole run without any adapter wiring', async () => {
    const inspected: InspectionEvent[] = [];
    const durable = createDurable(
      machine,
      {
        executeAction: () => {},
        startActor: (actor) => {
          actor.start();
        },
        waitForEvent: () => {
          throw new Error('host-driven loop');
        }
      },
      { inspect: (ev) => inspected.push(ev) }
    );

    const [snapshot, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    const done = await durable.waitForEvent();
    const [next] = durable.transition(snapshot, done);
    expect(next.status).toBe('active');
    expect((next as { value?: unknown }).value).toBe('approved');

    const types = new Set(inspected.map((ev) => ev.type));
    // The two-event protocol covers the whole run: actor topology (root and
    // the invoked child, observed from construction) plus every transition.
    expect(types).toContain('@xstate.actor');
    expect(types).toContain('@xstate.transition');
    const actors = inspected
      .filter((ev) => ev.type === '@xstate.actor')
      .map((ev) => (ev.actorRef as { address?: string }).address);
    expect(actors).toContain('order');
    expect(actors).toContain('order/fraud');
    // The completion transition is observed with its causing event.
    expect(
      inspected.some(
        (ev) =>
          ev.type === '@xstate.transition' &&
          ev.event.type.startsWith('xstate.done.actor')
      )
    ).toBe(true);
  });

  it('inspection is host observability only: none without the option', async () => {
    const durable = createDurable(machine, {
      executeAction: () => {},
      startActor: (actor) => {
        actor.start();
      },
      waitForEvent: () => {
        throw new Error('host-driven loop');
      }
    });
    const [snapshot, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    const [next] = durable.transition(snapshot, await durable.waitForEvent());
    expect((next as { value?: unknown }).value).toBe('approved');
  });
});
