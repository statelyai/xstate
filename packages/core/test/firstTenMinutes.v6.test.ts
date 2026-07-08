/**
 * "First ten minutes" DX benchmark (see V6_REVIEW.md §3.1).
 *
 * The five most common beginner tasks, written in v6 exactly as the docs
 * (migration.md) teach them — no internal knowledge assumed, no `any` casts.
 * Each test is the complete program a newcomer would write. This suite must
 * both PASS at runtime and TYPECHECK (`pnpm typecheck`); if an API change
 * breaks either, the first-ten-minutes experience regressed.
 *
 * Line counts / concept counts in V6_REVIEW.md are derived from these
 * definitions; if you change one, update the table.
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import {
  createMachine,
  createActor,
  createAsyncLogic,
  waitFor
} from '../src/index.ts';

describe('first ten minutes (v6)', () => {
  // Task 1 — toggle.
  // Concepts: createMachine, initial/states/on, createActor, send, getSnapshot
  it('toggle', () => {
    const toggleMachine = createMachine({
      initial: 'inactive',
      states: {
        inactive: { on: { toggle: { target: 'active' } } },
        active: { on: { toggle: { target: 'inactive' } } }
      }
    });

    const actor = createActor(toggleMachine).start();
    actor.send({ type: 'toggle' });

    expect(actor.getSnapshot().value).toBe('active');
  });

  // Task 2 — fetch with loading/error.
  // Concepts: + context, createAsyncLogic, invoke (src/input/onDone/onError),
  // event.output, returning { target, context }
  it('fetch with loading/error states', async () => {
    const fetchUser = createAsyncLogic({
      run: async ({ input }: { input: { id: number } }) => {
        if (input.id < 0) throw new Error('bad id');
        return { id: input.id, name: 'Ada' };
      }
    });

    const userMachine = createMachine({
      context: { user: null as { id: number; name: string } | null },
      initial: 'idle',
      states: {
        idle: { on: { load: { target: 'loading' } } },
        loading: {
          invoke: {
            src: fetchUser,
            input: { id: 1 },
            onDone: ({ event }) => ({
              target: 'loaded',
              context: { user: event.output }
            }),
            onError: { target: 'failed' }
          }
        },
        loaded: {},
        failed: {}
      }
    });

    const actor = createActor(userMachine).start();
    actor.send({ type: 'load' });
    const final = await waitFor(actor, (s) => s.matches('loaded'));

    expect(final.context.user).toEqual({ id: 1, name: 'Ada' });
  });

  // Task 3 — multi-step form.
  // Concepts: + schemas.events (typed payloads), actor.trigger
  it('multi-step form', () => {
    const formMachine = createMachine({
      schemas: {
        events: {
          next: z.object({ value: z.string() }),
          back: z.object({})
        }
      },
      context: { name: '', email: '' },
      initial: 'name',
      states: {
        name: {
          on: {
            next: ({ event }) => ({
              target: 'email',
              context: { name: event.value }
            })
          }
        },
        email: {
          on: {
            back: { target: 'name' },
            next: ({ event }) => ({
              target: 'done',
              context: { email: event.value }
            })
          }
        },
        done: { type: 'final' }
      }
    });

    const actor = createActor(formMachine).start();
    actor.trigger.next({ value: 'Ada' });
    actor.trigger.next({ value: 'ada@example.com' });

    expect(actor.getSnapshot().value).toBe('done');
    expect(actor.getSnapshot().context).toEqual({
      name: 'Ada',
      email: 'ada@example.com'
    });
  });

  // Task 4 — debounced input.
  // Concepts: + enq, enq.raise with delay + id, enq.cancel
  it('debounced input', async () => {
    const searches: string[] = [];

    const searchMachine = createMachine({
      schemas: {
        events: {
          type: z.object({ value: z.string() }),
          search: z.object({})
        }
      },
      context: { query: '' },
      on: {
        type: ({ event }, enq) => {
          enq.cancel('debounce');
          enq.raise({ type: 'search' }, { delay: 10, id: 'debounce' });
          return { context: { query: event.value } };
        },
        search: ({ context }, enq) => {
          enq(() => searches.push(context.query));
        }
      }
    });

    const actor = createActor(searchMachine).start();
    actor.trigger.type({ value: 'a' });
    actor.trigger.type({ value: 'ab' });
    actor.trigger.type({ value: 'abc' });
    await sleep(30);

    expect(searches).toEqual(['abc']);
  });

  // Task 5 — parent-child actorSources.
  // Concepts: + enq.spawn, children, enq.sendTo, parent
  it('parent-child actors', () => {
    const counterMachine = createMachine({
      context: { count: 0 },
      on: {
        inc: ({ context, parent }, enq) => {
          const count = context.count + 1;
          if (count === 2) {
            enq.sendTo(parent, { type: 'childDone' });
          }
          return { context: { count } };
        }
      }
    });

    const parentMachine = createMachine({
      initial: 'working',
      entry: (_, enq) => {
        enq.spawn(counterMachine, { id: 'counter' });
      },
      states: {
        working: {
          on: {
            ping: ({ children }, enq) => {
              enq.sendTo(children.counter, { type: 'inc' });
            },
            childDone: { target: 'finished' }
          }
        },
        finished: { type: 'final' }
      }
    });

    const actor = createActor(parentMachine).start();
    actor.send({ type: 'ping' });
    actor.send({ type: 'ping' });

    expect(actor.getSnapshot().value).toBe('finished');
  });
});
