import { setTimeout as sleep } from 'node:timers/promises';
import {
  createActor,
  createMachine,
  initialTransition,
  transition
} from '../src/index.ts';

describe('async transition functions', () => {
  it('throws a synchronous execution error when a transition function returns a promise', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOAD: (async () => ({ target: 'idle' })) as any
          }
        }
      }
    });
    const [snapshot] = initialTransition(machine);

    expect(() => transition(machine, snapshot, { type: 'LOAD' })).toThrow(
      'Transition functions must be synchronous. Transition for event "LOAD" in state "(machine).idle" returned a promise. Move async work into an invoked or spawned actor, or enq.effect.'
    );

    const error = vi.fn();
    const actor = createActor(machine);
    actor.subscribe({ error });
    actor.start();
    actor.send({ type: 'LOAD' });

    expect(actor.getSnapshot().status).toBe('error');
    expect(error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'Transition functions must be synchronous'
        )
      })
    );
  });

  it('lets state onError recover from an async transition function', () => {
    const actor = createActor(
      createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: { LOAD: (async () => {}) as any },
            onError: { target: 'failed' }
          },
          failed: {}
        }
      })
    ).start();
    actor.send({ type: 'LOAD' });

    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().value).toBe('failed');
  });

  it('throws when enq.* is called after the transition function returned', () => {
    const handles: any[] = [];
    const actor = createActor(
      createMachine({
        on: {
          // selection-phase handle (no enq call during the function)
          KEEP: (_, enq) => {
            handles.push(enq);
            return {};
          },
          // execution-phase handle (enq called during the function)
          KEEP_AND_RAISE: (_, enq) => {
            handles.push(enq);
            enq.raise({ type: 'noop' });
          }
        }
      })
    ).start();
    actor.send({ type: 'KEEP' });
    actor.send({ type: 'KEEP_AND_RAISE' });

    expect(handles.length).toBeGreaterThanOrEqual(2);
    for (const enq of handles) {
      expect(() => enq.raise({ type: 'late' })).toThrow(
        'enq.* called after the transition function returned'
      );
    }
    expect(actor.getSnapshot().status).toBe('active');
  });

  it('does not leak an unhandled rejection from an async transition function', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const actor = createActor(
        createMachine({
          on: {
            LOAD: (async (_: unknown, enq: any) => {
              await Promise.resolve();
              enq.raise({ type: 'late' });
            }) as any
          }
        })
      );
      actor.subscribe({ error: () => {} });
      actor.start();
      actor.send({ type: 'LOAD' });
      await sleep(10);
    } finally {
      process.off('unhandledRejection', unhandled);
    }

    expect(unhandled).not.toHaveBeenCalled();
  });
});
