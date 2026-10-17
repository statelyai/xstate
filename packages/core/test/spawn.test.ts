import { z } from 'zod';
import { createActor, createMachine, type AnyActor } from '../src';

describe('spawn inside machine', () => {
  it('input is required when defined in actor', () => {
    const childMachine = createMachine({
      // types: { input: {} as { value: number } }
    });

    const machine = createMachine({
      // types: {} as { context: { ref: ActorRefFrom<typeof childMachine> } },
      schemas: {
        context: z.object({
          ref: z.any()
        })
      },
      context: ({ spawn }) => ({
        ref: spawn(childMachine, { input: { value: 42 }, registryKey: 'test' })
      })
    });

    const actor = createActor(machine).start();
    expect(actor.system.get('test')).toBeDefined();
  });
});

describe('spawn during speculative evaluation', () => {
  const child = createMachine({ id: 'worker' });

  it('returns an inert ref when `can()` evaluates a spawning transition', () => {
    const refs: AnyActor[] = [];
    const machine = createMachine({
      id: 'parent',
      on: {
        SPAWN: (_, enq) => {
          refs.push(enq.spawn(child, { id: 'w' }));
          return {};
        }
      }
    });
    const actor = createActor(machine).start();

    expect(actor.getSnapshot().can({ type: 'SPAWN' })).toBe(true);

    const [ref] = refs;
    expect(ref!.id).toBe('w');
    expect(ref!.sessionId).toBeUndefined();
    // `can()` evaluates detached from the parent actor: no address.
    expect(ref!.address).toBeUndefined();
    expect(ref!.getSnapshot()).toBe(ref!.getSnapshot());
    expect(ref!.getSnapshot()).toMatchObject({ status: 'active' });
    expect(() => ref!.send({ type: 'ANY' })).not.toThrow();
    expect(() => JSON.stringify(ref)).toThrow(/speculative transition/);
    expect(actor.getSnapshot().children).toEqual({});
  });

  it('gives the inert ref the id and address a real spawn would get', () => {
    const refs: AnyActor[] = [];
    const machine = createMachine({
      id: 'parent',
      type: 'parallel',
      states: {
        a: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                SPAWN: (_, enq) => {
                  refs.push(enq.spawn(child));
                  return { target: 'done' };
                }
              }
            },
            done: {}
          }
        },
        b: {
          initial: 'idle',
          states: { idle: { on: { SPAWN: { target: 'done' } } }, done: {} }
        }
      }
    });
    const actor = createActor(machine).start();

    actor.send({ type: 'SPAWN' });

    // Resolving the two enabled transitions evaluates `a`'s transition
    // speculatively first, then for real.
    const [inert, real] = refs;
    expect(inert!.sessionId).toBeUndefined();
    expect(inert!.id).toBe('worker:0');
    expect(inert!.address).toBe('parent/worker:0');
    expect(inert!.toJSON!()).toEqual({ $actor: 'parent/worker:0' });
    expect(real!.id).toBe('worker:0');
    expect(real!.address).toBe(inert!.address);
    expect(Object.keys(actor.getSnapshot().children)).toEqual(['worker:0']);
  });
});
