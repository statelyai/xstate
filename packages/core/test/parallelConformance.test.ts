import {
  createMachine,
  createActor,
  createCallbackLogic,
  initialTransition,
  transition
} from '../src/index.ts';

describe('parallel state conformance', () => {
  it.each([false, true])(
    'resolves cross-region conflicts in document order (exit first: %s)',
    (exitFirst) => {
      const A = {
        initial: 'a1',
        states: {
          a1: { on: { E: { target: '#m.P.B' } } }
        }
      };
      const B = { on: { E: { target: '#m.X' } } };
      const machine = createMachine({
        id: 'm',
        initial: 'P',
        states: {
          P: {
            type: 'parallel',
            states: exitFirst ? { B, A } : { A, B }
          },
          X: {}
        }
      });

      const [initial] = initialTransition(machine);
      const [next] = transition(machine, initial, { type: 'E' });

      expect(next.value).toEqual(exitFirst ? 'X' : { P: { A: 'a1', B: {} } });
      expect(next.nodes.map((node) => node.id).sort()).toEqual(
        exitFirst ? ['m', 'm.X'] : ['m', 'm.P', 'm.P.A', 'm.P.A.a1', 'm.P.B']
      );
    }
  );

  it.each([false, true])(
    'restarts a target region invocation (reenter: %s)',
    (reenter) => {
      const record = vi.fn();
      const errors: unknown[] = [];
      const worker = createCallbackLogic(() => {
        record('start worker');
        return () => record('stop worker');
      });
      const machine = createMachine({
        id: 'm',
        type: 'parallel',
        states: {
          A: { on: { E: { target: '#m.B', reenter } } },
          B: {
            initial: 'b1',
            invoke: { id: 'worker', src: worker },
            entry: (_, enq) => enq(record, 'entry B'),
            exit: (_, enq) => enq(record, 'exit B'),
            states: {
              b1: { on: { NEXT: { target: 'b2' } } },
              b2: {}
            }
          }
        }
      });
      const actor = createActor(machine);
      actor.subscribe({ error: (error) => errors.push(error) });
      actor.start();
      const child = actor.getSnapshot().children.worker;

      try {
        expect(child).toBeDefined();
        expect(record.mock.calls).toEqual([['entry B'], ['start worker']]);
        actor.send({ type: 'NEXT' });
        record.mockClear();

        actor.send({ type: 'E' });

        expect(errors).toEqual([]);
        expect(actor.getSnapshot().value).toEqual({ A: {}, B: 'b1' });
        expect(actor.getSnapshot().children.worker).not.toBe(child);
        expect(record.mock.calls).toEqual([
          ['exit B'],
          ['stop worker'],
          ['entry B'],
          ['start worker']
        ]);
        record.mockClear();
      } finally {
        actor.stop();
      }
      expect(record.mock.calls).toEqual([['stop worker']]);
    }
  );

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

  it('gives the first cross-region transition priority on repeated events (#4793)', () => {
    const machine = createMachine({
      id: 'question-flow',
      type: 'parallel',
      states: {
        value1: {
          initial: 'x',
          states: {
            x: { on: { NEXT: { target: '#question-flow.value2.shown' } } },
            done: { type: 'final' }
          }
        },
        value2: {
          id: 'value2',
          initial: 'hidden',
          states: {
            shown: { on: { NEXT: { target: '#question-flow.value3.shown' } } },
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
      value1: 'x',
      value2: 'shown',
      value3: 'hidden'
    });

    actor.send({ type: 'NEXT' });
    expect(actor.getSnapshot().value).toEqual({
      value1: 'x',
      value2: 'shown',
      value3: 'hidden'
    });
  });

  it('uses history recorded by a cross-region exit for entry planning', () => {
    const machine = createMachine({
      id: 'm',
      initial: 'P',
      states: {
        P: {
          type: 'parallel',
          on: { LEAVE: { target: '#outside' } },
          states: {
            A: {
              id: 'A',
              initial: 'a',
              states: {
                a: { on: { RESTORE_B: { target: '#bHistory' } } }
              }
            },
            B: {
              id: 'B',
              initial: 'cold',
              states: {
                history: {
                  id: 'bHistory',
                  type: 'history',
                  history: 'deep',
                  target: 'cold'
                },
                cold: { initial: 'c', states: { c: {} } },
                warm: { id: 'warm', initial: 'w', states: { w: {} } }
              }
            }
          }
        },
        outside: {
          id: 'outside',
          on: { ENTER_WARM: { target: ['#A', '#warm'] } }
        }
      }
    });
    const actor = createActor(machine).start();

    actor.send({ type: 'LEAVE' });
    actor.send({ type: 'ENTER_WARM' });
    expect(actor.getSnapshot().value).toEqual({
      P: { A: 'a', B: { warm: 'w' } }
    });

    actor.send({ type: 'RESTORE_B' });
    expect(actor.getSnapshot().value).toEqual({
      P: { A: 'a', B: { warm: 'w' } }
    });
    expect(actor.getSnapshot().nodes.map((node) => node.id)).not.toContain(
      'm.P.B.cold'
    );
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
