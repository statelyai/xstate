import { createActor, createMachine } from '../src/index.ts';
import type { AnyMachineSnapshot } from '../src/index.ts';

describe("snapshot.matches('#id')", () => {
  const machine = createMachine({
    id: 'root',
    initial: 'a',
    states: {
      a: {
        initial: 'one',
        states: {
          one: { id: 'one', on: { next: { target: 'two' } } },
          two: { id: 'two' }
        },
        on: { toB: { target: 'b' } }
      },
      b: {
        type: 'parallel',
        states: {
          left: {
            initial: 'l1',
            states: { l1: { id: 'l1' }, l2: { id: 'l2' } }
          },
          right: {
            initial: 'r1',
            states: { r1: {}, r2: { id: 'r2' } }
          }
        }
      }
    }
  });

  it('is true while the state node with that id is active', () => {
    const actor = createActor(machine).start();
    const snapshot = actor.getSnapshot();

    expect(snapshot.matches('#root')).toBe(true);
    expect(snapshot.matches('#one')).toBe(true);
    expect(snapshot.matches('#root.a')).toBe(true);
    expect(snapshot.matches('#two')).toBe(false);
    expect(snapshot.matches('#root.b')).toBe(false);

    actor.send({ type: 'next' });
    expect(actor.getSnapshot().matches('#two')).toBe(true);
    expect(actor.getSnapshot().matches('#one')).toBe(false);
  });

  it('checks each region of a parallel state', () => {
    const actor = createActor(machine).start();
    actor.send({ type: 'toB' });
    const snapshot = actor.getSnapshot();

    expect(snapshot.matches('#root.b')).toBe(true);
    expect(snapshot.matches('#l1')).toBe(true);
    expect(snapshot.matches('#root.b.right.r1')).toBe(true);
    expect(snapshot.matches('#l2')).toBe(false);
    expect(snapshot.matches('#r2')).toBe(false);
    expect(snapshot.matches('#one')).toBe(false);
  });

  it('throws for an unknown id', () => {
    const snapshot: AnyMachineSnapshot = createActor(machine)
      .start()
      .getSnapshot();

    expect(() => snapshot.matches('#nope')).toThrow('No state has id "nope".');
  });

  it('accepts only known ids when the ids are statically known', () => {
    const snapshot = createActor(machine).getSnapshot();

    // Type-level only: unknown ids throw at runtime.
    void (() => {
      snapshot.matches('#one');
      snapshot.matches('#root');
      snapshot.matches('#root.b.right');
      snapshot.matches('#r2');
      // @ts-expect-error - no state has this id
      snapshot.matches('#nope');
      // @ts-expect-error - `r1` has no explicit id
      snapshot.matches('#r1');
    });
  });

  it('accepts the ids of every member of a snapshot union', () => {
    const other = createMachine({
      id: 'other',
      initial: 'x',
      states: { x: { id: 'x' } }
    });
    const snapshot = createActor(machine).getSnapshot() as
      | ReturnType<typeof machine.getInitialSnapshot>
      | ReturnType<typeof other.getInitialSnapshot>;

    expect(snapshot.matches('#one')).toBe(true);
    void (() => {
      snapshot.matches('#x');
      // @ts-expect-error - no state has this id
      snapshot.matches('#nope');
    });
  });

  it('accepts any id when the ids are not statically known', () => {
    const snapshot: AnyMachineSnapshot = createActor(machine).getSnapshot();

    expect(snapshot.matches('#one')).toBe(true);
  });
});
