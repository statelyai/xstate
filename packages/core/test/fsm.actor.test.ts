import { createFSM } from '../src/fsm.ts';
import { createActor } from '../src/createActor.ts';
import { initialTransition, transition } from '../src/transition.ts';

function createCounter() {
  return createFSM<
    { count: number },
    { type: 'inc' } | { type: 'stop' },
    { active: unknown; stopped: unknown }
  >({
    initial: 'active',
    context: { count: 0 },
    states: {
      active: {
        on: {
          inc: ({ context }) => ({ context: { count: context.count + 1 } }),
          stop: 'stopped'
        }
      },
      stopped: {}
    }
  });
}

describe('createFSM as actor logic', () => {
  it('runs in createActor', () => {
    const actor = createActor(createCounter()).start();
    const values: string[] = [];
    actor.subscribe((snapshot) => {
      values.push(`${snapshot.value}:${snapshot.context.count}`);
    });

    actor.send({ type: 'inc' });
    actor.send({ type: 'inc' });
    actor.send({ type: 'stop' });
    actor.send({ type: 'inc' });

    expect(actor.getSnapshot().value).toBe('stopped');
    expect(actor.getSnapshot().context).toEqual({ count: 2 });
    expect(actor.getSnapshot().status).toBe('active');
    expect(values).toEqual(['active:1', 'active:2', 'stopped:2', 'stopped:2']);
  });

  it('works with transition()', () => {
    const fsm = createCounter();
    const [next, effects] = transition(fsm, fsm.initialState, { type: 'inc' });

    expect(next.value).toBe('active');
    expect(next.context).toEqual({ count: 1 });
    expect(effects).toEqual([]);
    expect(fsm.transition(fsm.initialState, { type: 'inc' })).toEqual([
      next,
      []
    ]);
  });

  it('works with initialTransition()', () => {
    const fsm = createCounter();
    const [snapshot, effects] = initialTransition(fsm);

    expect(snapshot).toBe(fsm.initialState);
    expect(effects).toEqual([]);
    expect(fsm.getInitialSnapshot()).toBe(fsm.initialState);
  });

  it('restores a persisted snapshot', () => {
    const fsm = createCounter();
    const actor = createActor(fsm).start();
    actor.send({ type: 'inc' });
    const persisted = JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));

    const restored = createActor(fsm, { snapshot: persisted }).start();
    expect(restored.getSnapshot().value).toBe('active');
    expect(restored.getSnapshot().context).toEqual({ count: 1 });

    restored.send({ type: 'inc' });
    expect(restored.getSnapshot().context).toEqual({ count: 2 });
  });
});
