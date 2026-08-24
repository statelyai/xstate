import { createMachine, createActor } from '../src/index.ts';

describe('parallel state conformance', () => {
  // Bug 1 — #5214: transition targeting one region resets sibling regions
  it('a transition targeting one region should not reset sibling regions', () => {
    const machine = createMachine({
      id: 'p',
      type: 'parallel',
      on: {
        ARCHIVE: { target: '#p.phase.archive' },
        EDIT: { target: '#p.mode.edit' }
      },
      states: {
        phase: {
          initial: 'inquiry',
          states: { inquiry: {}, archive: {} }
        },
        mode: {
          initial: 'new',
          states: { new: {}, edit: {} }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'EDIT' });
    actor.send({ type: 'ARCHIVE' });

    expect(actor.getSnapshot().value).toEqual({
      phase: 'archive',
      mode: 'edit'
    });
  });

  // Bug 2 — #5162: reenter:true in one region re-runs SIBLING region entry actions
  it('reenter in one region should not re-run sibling region entry actions', () => {
    const machine = createMachine({
      id: 'reentrytest',
      type: 'parallel',
      context: { count: 0 },
      states: {
        someStateWithReentry: {
          initial: 'a',
          states: { a: {}, b: {} },
          on: {
            REENTER_A: { target: '.a', reenter: true }
          }
        },
        sibling: {
          entry: ({ context }) => ({ context: { count: context.count + 1 } }),
          initial: 'c',
          states: { c: {}, d: {} }
        }
      }
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().context.count).toBe(1);

    actor.send({ type: 'REENTER_A' });
    expect(actor.getSnapshot().context.count).toBe(1);
  });

  // Bug 3 — #4793: after a transition from a final region, subsequent events
  // in sibling regions are dropped
  it('sibling region events should still be handled after a final region transitions', () => {
    const machine = createMachine({
      id: 'question-flow',
      type: 'parallel',
      states: {
        value1: {
          type: 'final',
          on: { NEXT: { target: '#question-flow.value2.shown' } }
        },
        value2: {
          id: 'value2',
          initial: 'hidden',
          states: {
            shown: { on: { NEXT: { target: '#value3.shown' } } },
            hidden: {}
          }
        },
        value3: {
          id: 'value3',
          initial: 'hidden',
          states: {
            hidden: {},
            shown: { type: 'final' }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'NEXT' });
    expect(actor.getSnapshot().value).toEqual({
      value1: {},
      value2: 'shown',
      value3: 'hidden'
    });

    actor.send({ type: 'NEXT' });
    // A cross-region transition only exits the region containing its
    // targets, so value2 stays 'shown' while value3 advances.
    expect(actor.getSnapshot().value).toEqual({
      value1: {},
      value2: 'shown',
      value3: 'shown'
    });
  });

  // Passing guard — a `type: 'final'` region under a parallel root has no
  // outgoing transitions of its own; an event with no matching handler
  // anywhere leaves every region untouched.
  it('a final region under a parallel root should ignore events it does not handle', () => {
    const machine = createMachine({
      id: 'g',
      type: 'parallel',
      states: {
        regionA: {
          type: 'final'
        },
        regionB: {
          initial: 'idle',
          states: { idle: {}, other: {} }
        }
      }
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().value).toEqual({
      regionA: {},
      regionB: 'idle'
    });

    actor.send({ type: 'GO' });
    expect(actor.getSnapshot().value).toEqual({
      regionA: {},
      regionB: 'idle'
    });
  });
});
