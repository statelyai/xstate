import {
  createActor,
  createMachine,
  SimulatedClock,
  InspectionEvent,
  ActorInspectionEvent,
  TransitionInspectionEvent
} from '../src';
import { XSTATE_INIT } from '../src/constants';

/**
 * Conformance test for the v6 inspection protocol (B2).
 *
 * The protocol is two event types — `@xstate.actor` (topology) and
 * `@xstate.transition` (+ `@xstate.microstep`) — and must losslessly capture
 * every facet the v5 6-event protocol did:
 *
 * - Actor topology (identity + parent), via `@xstate.actor`
 * - Executed actions, via `@xstate.transition.actions[]`
 * - Sent / scheduled events, via `@xstate.transition.sent[]`
 * - Microsteps, via `@xstate.transition.microsteps[]`
 *
 * All facets are flat & always-present so consumers never narrow on an absent
 * property.
 */
describe('v6 inspection protocol conformance', () => {
  const childMachine = createMachine({
    initial: 'idle',
    states: {
      idle: { on: { PING: { target: 'pinged' } } },
      pinged: {}
    }
  });

  function namedAction() {
    /* executed custom action */
  }

  function buildMachine() {
    return createMachine({
      context: { count: 0 } as { count: number; childRef?: any },
      initial: 'start',
      states: {
        start: {
          entry: (_, enq) => {
            const childRef = enq.spawn(childMachine, { id: 'myChild' });
            enq(namedAction);
            // delayed self-raise (may be scheduled and delivered later)
            enq.raise({ type: 'GO' }, { delay: 100 });
            // delayed sendTo a *different* actor, with an explicit id
            enq.sendTo(childRef, { type: 'PING' }, { delay: 50, id: 'ping-1' });
            return { context: { count: 0, childRef } };
          },
          on: { GO: { target: 'middle' } }
        },
        middle: {
          // multi-microstep: loop via `always` before settling on `done`
          always: ({ context }) => {
            if (context.count < 2) {
              return { context: { count: context.count + 1 } };
            }
            return { target: 'done' };
          }
        },
        done: { type: 'final' }
      }
    });
  }

  function runAndCollect() {
    const events: InspectionEvent[] = [];
    const clock = new SimulatedClock();
    const actor = createActor(buildMachine(), {
      inspect: (ev) => events.push(ev),
      clock
    });
    actor.start();
    // fire both scheduled sends (PING @50, GO @100)
    clock.increment(100);
    return { events, actor };
  }

  const actorEvents = (events: InspectionEvent[]) =>
    events.filter((e): e is ActorInspectionEvent => e.type === '@xstate.actor');
  const transitionEvents = (events: InspectionEvent[]) =>
    events.filter(
      (e): e is TransitionInspectionEvent => e.type === '@xstate.transition'
    );

  it('emits exactly one @xstate.actor topology event per actor, with parentRef', () => {
    const { events, actor } = runAndCollect();
    const actors = actorEvents(events);

    // root + child = 2 actors
    expect(actors).toHaveLength(2);

    const root = actors.find((a) => a.parentRef === undefined);
    const child = actors.find((a) => a.id === 'myChild');

    expect(root).toBeDefined();
    expect(root!.actorRef).toBe(actor);
    expect(root!.snapshot).toBeDefined();

    expect(child).toBeDefined();
    // the child's parent is the root actor — topology is reconstructable
    expect(child!.parentRef).toBe(actor);
    expect(child!.snapshot).toBeDefined();
  });

  it('captures every executed action in actions[]', () => {
    const { events } = runAndCollect();
    const actionTypes = transitionEvents(events).flatMap((e) =>
      e.actions.map((a) => a.type)
    );

    // the named custom action ran during the `start` entry
    expect(actionTypes).toContain('namedAction');
    // built-in send action also recorded
    expect(actionTypes).toContain('@xstate.sendTo');
  });

  it('captures every relayed/scheduled event in sent[] with delay & id', () => {
    const { events, actor } = runAndCollect();
    const sent = transitionEvents(events).flatMap((e) => e.sent);

    const ping = sent.find((s) => s.event.type === 'PING');
    expect(ping).toBeDefined();
    expect(ping!.delay).toBe(50);
    expect(ping!.id).toBe('ping-1');
    expect(ping!.targetId).toBe('myChild');

    const go = sent.find((s) => s.event.type === 'GO');
    expect(go).toBeDefined();
    expect(go!.delay).toBe(100);
    // delayed self-raise targets the root actor itself
    expect(go!.targetId).toBe(actor.id);
  });

  it('captures microsteps of a multi-microstep transition', () => {
    const { events } = runAndCollect();
    const hasMicrosteps = transitionEvents(events).some(
      (e) => e.microsteps.length > 0
    );
    expect(hasMicrosteps).toBe(true);

    // final snapshot is reachable and `done`
    const last = transitionEvents(events).at(-1)!;
    expect((last.snapshot as any).value).toBe('done');
  });

  it('all facets are flat & always-present (no narrowing on absent fields)', () => {
    const { events } = runAndCollect();

    for (const e of events) {
      if (e.type === '@xstate.actor') {
        // topology fields are always present
        expect('parentRef' in e).toBe(true);
        expect(typeof e.id).toBe('string');
        expect(e.snapshot).toBeDefined();
        expect('src' in e).toBe(true);
      } else {
        // transition/microstep facets are arrays — always present, never absent
        expect(Array.isArray(e.actions)).toBe(true);
        expect(Array.isArray(e.sent)).toBe(true);
        expect(Array.isArray(e.microsteps)).toBe(true);
        expect(e.event).toBeDefined();
        expect(e.snapshot).toBeDefined();
      }
    }
  });

  it('actor tree + action timeline are fully reconstructable from the two event types alone', () => {
    const { events, actor } = runAndCollect();

    // 1. reconstruct the actor tree purely from @xstate.actor events
    const tree = new Map<string, string[]>();
    for (const a of actorEvents(events)) {
      const parentId = (a.parentRef as any)?.id ?? '(root)';
      const list = tree.get(parentId) ?? [];
      list.push(a.id);
      tree.set(parentId, list);
    }
    // root has no parent; child sits under the root actor
    expect(tree.get('(root)')).toEqual([actor.id]);
    expect(tree.get(actor.id)).toContain('myChild');

    // 2. reconstruct the full action timeline from @xstate.transition events
    const timeline = transitionEvents(events).flatMap((e) =>
      e.actions.map((a) => a.type)
    );
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline).toContain('namedAction');

    // 3. the init transition is present (snapshot lineage starts at init)
    const initEvent = transitionEvents(events).find(
      (e) => e.event.type === XSTATE_INIT
    );
    expect(initEvent).toBeDefined();
  });
});
