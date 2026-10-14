import { z } from 'zod';
import { createActor, createMachine, setup } from '../src/index.ts';

class Counter {
  count = 0;
  increment() {
    this.count++;
  }
}

describe('frozen context (development)', () => {
  it('throws when mutating a top-level context property', () => {
    const machine = createMachine({
      context: { foo: 0 }
    });
    const actor = createActor(machine).start();

    expect(Object.isFrozen(actor.getSnapshot().context)).toBe(true);
    expect(() => {
      (actor.getSnapshot().context as any).foo = 1;
    }).toThrow(TypeError);
    expect(actor.getSnapshot().context.foo).toBe(0);
  });

  it('throws when mutating nested objects and arrays', () => {
    const machine = createMachine({
      context: { user: { name: 'David' }, items: [{ id: 1 }] }
    });
    const { context } = createActor(machine).start().getSnapshot();

    expect(() => {
      (context.user as any).name = 'other';
    }).toThrow(TypeError);
    expect(() => {
      (context.items as any).push({ id: 2 });
    }).toThrow(TypeError);
    expect(() => {
      (context.items[0] as any).id = 2;
    }).toThrow(TypeError);
  });

  it('does not freeze actor refs, class instances, Map, Set or Date', () => {
    const child = createMachine({
      context: { received: 0 },
      on: {
        ping: ({ context }) => ({
          context: { received: context.received + 1 }
        })
      }
    });
    const machine = createMachine({
      schemas: {
        context: z.object({
          ref: z.any(),
          counter: z.any(),
          map: z.any(),
          set: z.any(),
          date: z.any()
        })
      },
      context: ({ spawn }) => ({
        ref: spawn(child),
        counter: new Counter(),
        map: new Map<string, number>(),
        set: new Set<number>(),
        date: new Date(0)
      })
    });
    const actor = createActor(machine).start();
    const { context } = actor.getSnapshot();

    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.ref)).toBe(false);
    expect(Object.isFrozen(context.counter)).toBe(false);
    expect(Object.isFrozen(context.map)).toBe(false);

    context.counter.increment();
    expect(context.counter.count).toBe(1);
    context.map.set('a', 1);
    expect(context.map.get('a')).toBe(1);
    context.set.add(1);
    expect(context.set.has(1)).toBe(true);
    context.date.setTime(1);
    expect(context.date.getTime()).toBe(1);

    context.ref.send({ type: 'ping' });
    context.ref.send({ type: 'ping' });
    expect(context.ref.getSnapshot().context.received).toBe(2);
  });

  it('allows normal transitions with context updates', () => {
    const machine = createMachine({
      context: { count: 0, items: [] as number[] },
      initial: 'idle',
      states: {
        idle: {
          on: {
            add: ({ context }) => ({
              target: 'active',
              context: {
                count: context.count + 1,
                items: [...context.items, context.count]
              }
            })
          }
        },
        active: {
          entry: ({ context }) => ({
            context: { count: context.count * 10 }
          }),
          on: {
            add: ({ context }) => ({
              context: {
                count: context.count + 1,
                items: [...context.items, context.count]
              }
            })
          }
        }
      }
    });
    const actor = createActor(machine).start();
    actor.send({ type: 'add' });
    actor.send({ type: 'add' });

    const { context } = actor.getSnapshot();
    expect(context).toEqual({ count: 11, items: [0, 10] });
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.items)).toBe(true);
  });

  it('freezes context restored from a persisted snapshot', () => {
    const child = createMachine({});
    const machine = setup({ actors: { child } }).createMachine({
      schemas: {
        context: z.object({
          nested: z.object({ value: z.number() }),
          empty: z.null(),
          ref: z.any(),
          refs: z.array(z.any())
        })
      },
      context: ({ spawn, actors }) => {
        const ref = spawn(actors.child);
        return { nested: { value: 1 }, empty: null, ref, refs: [ref] };
      }
    });
    const persisted = JSON.parse(
      JSON.stringify(createActor(machine).start().getPersistedSnapshot())
    );
    const persistedCopy = JSON.parse(JSON.stringify(persisted));

    const restored = createActor(machine, { snapshot: persisted }).start();
    const { context } = restored.getSnapshot();

    expect(Object.isFrozen(context)).toBe(true);
    expect(() => {
      (context.nested as any).value = 2;
    }).toThrow(TypeError);
    // Actor refs are revived and left unfrozen
    expect(context.ref).toBe(restored.getSnapshot().children[context.ref.id]);
    expect(Object.isFrozen(context.ref)).toBe(false);
    expect(context.refs[0]).toBe(context.ref);
    expect(Object.isFrozen(context.refs)).toBe(true);
    expect(context.empty).toBe(null);
    // The caller-owned persisted snapshot is neither rewritten nor frozen
    expect(persisted.context.ref).toEqual(persistedCopy.context.ref);
    expect(Object.isFrozen(persisted.context)).toBe(false);
  });

  it('does not freeze context in production builds', async () => {
    vi.resetModules();
    vi.doMock('#is-development', () => ({ default: false }));
    try {
      const prod = await import('../src/index.ts');
      const machine = prod.createMachine({
        context: { foo: 0, nested: { bar: 0 } }
      });
      const { context } = prod.createActor(machine).start().getSnapshot();

      expect(Object.isFrozen(context)).toBe(false);
      expect(Object.isFrozen(context.nested)).toBe(false);
    } finally {
      vi.doUnmock('#is-development');
      vi.resetModules();
    }
  });
});

describe('development context freeze edge cases', () => {
  it('freezes mutable children of an already-frozen context object', () => {
    const inner = { count: 0 };
    const machine = createMachine({
      context: Object.freeze({ inner })
    });
    const actor = createActor(machine).start();
    expect(Object.isFrozen(actor.getSnapshot().context.inner)).toBe(true);
  });

  it('restores a context object that looks like a serialized actor ref', () => {
    const machine = createMachine({ context: { note: '' } });
    const persisted = JSON.parse(
      JSON.stringify({
        ...createActor(machine).getPersistedSnapshot(),
        context: { xstate$type: 'actorRef', id: 'missing', note: 'data' }
      })
    );
    const actor = createActor(machine, { snapshot: persisted });
    expect(actor.getSnapshot().context).toEqual({
      xstate$type: 'actorRef',
      id: 'missing',
      note: 'data'
    });
  });

  it('keeps a persisted `__proto__` key as data, not a prototype', () => {
    const machine = createMachine({ context: { value: 1 } });
    const persisted = JSON.parse(
      JSON.stringify(createActor(machine).getPersistedSnapshot()).replace(
        '"context":{"value":1}',
        '"context":{"value":1,"__proto__":{"injected":true}}'
      )
    );
    const context: any = createActor(machine, {
      snapshot: persisted
    }).getSnapshot().context;
    expect(Object.getPrototypeOf(context)).toBe(Object.prototype);
    expect(context.injected).toBeUndefined();
  });
});
