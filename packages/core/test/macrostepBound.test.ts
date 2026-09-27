import { z } from 'zod';
import {
  createActor,
  createMachine,
  InfiniteTransitionError
} from '../src/index.ts';

function countingMachine(target: number, maxIterations?: number) {
  return createMachine({
    id: 'counter',
    ...(maxIterations !== undefined && { options: { maxIterations } }),
    schemas: {
      context: z.object({ n: z.number() })
    },
    context: { n: 0 },
    initial: 'idle',
    states: {
      idle: {
        on: { START: { target: 'counting' } }
      },
      counting: {
        always: ({ context }) =>
          context.n < target ? { context: { n: context.n + 1 } } : undefined
      }
    }
  });
}

describe('macrostep bound', () => {
  it('throws InfiniteTransitionError at the default bound for an always loop', () => {
    const actor = createActor(
      createMachine({
        id: 'loop',
        initial: 'idle',
        states: {
          idle: { on: { GO: { target: 'a' } } },
          a: { always: { target: 'b' } },
          b: { always: { target: 'a' } }
        }
      })
    );
    const error = vi.fn();
    actor.subscribe({ error });
    actor.start();
    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().status).toBe('error');
    const err = error.mock.calls[0][0];
    expect(err).toBeInstanceOf(InfiniteTransitionError);
    expect(err.maxIterations).toBe(1000);
    expect(err.actorId).toBe(actor.id);
    expect(err.event).toEqual({ type: 'GO' });
  });

  it('names the actor, the event and the last 5 states in the message', () => {
    const actor = createActor(
      createMachine({
        initial: 'idle',
        options: { maxIterations: 10 },
        states: {
          idle: { on: { GO: { target: 'a' } } },
          a: { always: { target: 'b' } },
          b: { always: { target: 'c' } },
          c: { always: { target: 'a' } }
        }
      }),
      { id: 'looper' }
    );
    const error = vi.fn();
    actor.subscribe({ error });
    actor.start();
    actor.send({ type: 'GO' });

    const err = error.mock.calls[0][0] as InfiniteTransitionError;
    expect(err.states).toHaveLength(5);
    expect(err.message).toContain('actor "looper"');
    expect(err.message).toContain('event "GO"');
    expect(err.message).toContain('more than 10 microsteps');
    expect(err.message).toContain(
      `Last states: ${err.states.map((v) => JSON.stringify(v)).join(' -> ')}`
    );
    expect(new Set(err.states)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('counts 1000 microsteps within the default bound', () => {
    const actor = createActor(countingMachine(999)).start();
    actor.send({ type: 'START' });

    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().context.n).toBe(999);
  });

  it('allows 3000 microsteps with maxIterations: 5000', () => {
    const error = vi.fn();
    const failing = createActor(countingMachine(3000));
    failing.subscribe({ error });
    failing.start();
    failing.send({ type: 'START' });
    expect(error.mock.calls[0][0]).toBeInstanceOf(InfiniteTransitionError);

    const actor = createActor(countingMachine(3000, 5000)).start();
    actor.send({ type: 'START' });

    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().context.n).toBe(3000);
  });
});
