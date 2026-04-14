import z from 'zod';
import { createActor, createMachine } from '../src/index.ts';

describe('context mutation in transitions', () => {
  it('mutating the draft context updates the snapshot context', () => {
    const machine = createMachine({
      schemas: { context: z.object({ count: z.number() }) },
      context: { count: 0 },
      initial: 'active',
      states: {
        active: {
          on: {
            INC: ({ context }) => {
              context.count++;
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'INC' });
    expect(actor.getSnapshot().context).toEqual({ count: 1 });

    actor.send({ type: 'INC' });
    actor.send({ type: 'INC' });
    expect(actor.getSnapshot().context).toEqual({ count: 3 });
  });

  it('mutating draft preserves referential equality for unchanged subtrees', () => {
    const initialOther = { name: 'unchanged' };
    const machine = createMachine({
      schemas: {
        context: z.object({
          count: z.number(),
          other: z.object({ name: z.string() })
        })
      },
      context: { count: 0, other: initialOther },
      initial: 'active',
      states: {
        active: {
          on: {
            INC: ({ context }) => {
              context.count++;
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    const before = actor.getSnapshot().context;

    actor.send({ type: 'INC' });

    const after = actor.getSnapshot().context;
    expect(after).not.toBe(before);
    expect(after.other).toBe(before.other);
    expect(after.other).toBe(initialOther);
  });

  it('returning { context } still works (explicit replacement)', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({ count: z.number() }),
        events: { SET: z.object({ value: z.number() }) }
      },
      context: { count: 0 },
      initial: 'active',
      states: {
        active: {
          on: {
            SET: ({ context, event }) => ({
              context: { ...context, count: event.value }
            })
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'SET', value: 42 });
    expect(actor.getSnapshot().context.count).toBe(42);
  });

  it('explicit return overrides draft mutation', () => {
    const machine = createMachine({
      schemas: { context: z.object({ count: z.number() }) },
      context: { count: 0 },
      initial: 'active',
      states: {
        active: {
          on: {
            INC: ({ context }) => {
              context.count++;
              return { context: { count: 100 } };
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'INC' });
    expect(actor.getSnapshot().context.count).toBe(100);
  });

  it('untouched draft does not produce a new context object', () => {
    const machine = createMachine({
      schemas: { context: z.object({ count: z.number() }) },
      context: { count: 0 },
      initial: 'active',
      states: {
        active: {
          on: {
            // No mutation, no return.
            NOOP: () => undefined
          }
        }
      }
    });

    const actor = createActor(machine).start();
    const before = actor.getSnapshot().context;
    actor.send({ type: 'NOOP' });
    expect(actor.getSnapshot().context).toBe(before);
  });

  it('nested mutation produces new branches but shares siblings', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          a: z.object({ value: z.number() }),
          b: z.object({ value: z.number() })
        })
      },
      context: {
        a: { value: 1 },
        b: { value: 2 }
      },
      initial: 'active',
      states: {
        active: {
          on: {
            BUMP_A: ({ context }) => {
              context.a.value = 10;
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    const before = actor.getSnapshot().context;

    actor.send({ type: 'BUMP_A' });

    const after = actor.getSnapshot().context;
    expect(after).not.toBe(before);
    expect(after.a).not.toBe(before.a);
    expect(after.a.value).toBe(10);
    expect(after.b).toBe(before.b);
  });

  it('array mutations work', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({ items: z.array(z.number()) }),
        events: {
          PUSH: z.object({ value: z.number() }),
          POP: z.object({})
        }
      },
      context: { items: [1, 2, 3] },
      initial: 'active',
      states: {
        active: {
          on: {
            PUSH: ({ context, event }) => {
              context.items.push(event.value);
            },
            POP: ({ context }) => {
              context.items.pop();
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    const initial = actor.getSnapshot().context.items;

    actor.send({ type: 'PUSH', value: 4 });
    const afterPush = actor.getSnapshot().context.items;
    expect(afterPush).toEqual([1, 2, 3, 4]);
    expect(initial).toEqual([1, 2, 3]); // original unaffected
    expect(afterPush).not.toBe(initial);

    actor.send({ type: 'POP' });
    expect(actor.getSnapshot().context.items).toEqual([1, 2, 3]);
  });

  it('mutation in entry actions updates context', () => {
    const machine = createMachine({
      schemas: { context: z.object({ count: z.number() }) },
      context: { count: 0 },
      initial: 'a',
      states: {
        a: {
          on: { GO: { target: 'b' } }
        },
        b: {
          entry: ({ context }) => {
            context.count = 99;
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'GO' });
    expect(actor.getSnapshot().context.count).toBe(99);
  });

  it('mutation in exit actions updates context', () => {
    const machine = createMachine({
      schemas: { context: z.object({ count: z.number() }) },
      context: { count: 0 },
      initial: 'a',
      states: {
        a: {
          exit: ({ context }) => {
            context.count = 7;
          },
          on: { GO: { target: 'b' } }
        },
        b: {}
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'GO' });
    expect(actor.getSnapshot().context.count).toBe(7);
  });

  it('spread-and-mutate produces a new context (interop)', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          count: z.number(),
          list: z.array(z.number())
        })
      },
      context: { count: 0, list: [1, 2] },
      initial: 'active',
      states: {
        active: {
          on: {
            INC: ({ context }) => ({
              context: { ...context, count: context.count + 1 }
            })
          }
        }
      }
    });

    const actor = createActor(machine).start();
    const beforeList = actor.getSnapshot().context.list;
    actor.send({ type: 'INC' });
    const after = actor.getSnapshot().context;
    expect(after.count).toBe(1);
    expect(after.list).toBe(beforeList);
  });
});
