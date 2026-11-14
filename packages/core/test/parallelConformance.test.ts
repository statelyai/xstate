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
    'only applies the winning dynamic transition (exit first: %s)',
    (exitFirst) => {
      const record = vi.fn();
      const evaluations = { cross: 0, leave: 0 };
      const machine = createMachine({
        id: 'm',
        context: { winner: '' },
        initial: 'P',
        states: {
          P: {
            type: 'parallel',
            states: {
              first: {
                initial: 'a1',
                states: {
                  a1: {
                    on: {
                      E: (_, enq) => {
                        const winner = exitFirst ? 'leave' : 'cross';
                        evaluations[winner]++;
                        enq(record, winner);
                        return {
                          target: exitFirst ? '#m.X' : '#m.P.second',
                          context: { winner }
                        };
                      }
                    }
                  }
                }
              },
              second: {
                on: {
                  E: (_, enq) => {
                    const winner = exitFirst ? 'cross' : 'leave';
                    evaluations[winner]++;
                    enq(record, winner);
                    return {
                      target: exitFirst ? '#m.P.first' : '#m.X',
                      context: { winner }
                    };
                  }
                }
              }
            }
          },
          X: {}
        }
      });

      const [initial] = initialTransition(machine);
      const [next, effects] = transition(machine, initial, { type: 'E' });
      const winner = exitFirst ? 'leave' : 'cross';

      expect(next.context).toEqual({ winner });
      expect(effects).toMatchObject([{ action: record, args: [winner] }]);
      expect(evaluations).toEqual({ cross: 1, leave: 1 });
      expect(record).not.toHaveBeenCalled();
      for (const node of next.nodes) {
        if (node.parent) {
          expect(next.nodes).toContain(node.parent);
        }
      }
    }
  );

  it('resets the target region children without rerunning the retained region entry', () => {
    const record = vi.fn();
    const machine = createMachine({
      id: 'm',
      context: { version: 0 },
      type: 'parallel',
      states: {
        A: {
          initial: 'a1',
          states: {
            a1: { on: { E: { target: '#m.B' } } }
          }
        },
        B: {
          initial: {
            target: 'b1',
            input: ({ context }) => ({ version: context.version })
          },
          entry: (_, enq) => enq(record, 'entry B'),
          exit: (_, enq) => enq(record, 'exit B'),
          states: {
            b1: {
              entry: ({ input }, enq) => enq(record, 'entry b1', input),
              on: {
                NEXT: {
                  target: 'b2',
                  context: ({ context }) => ({ version: context.version + 1 })
                }
              }
            },
            b2: {
              exit: (_, enq) => enq(record, 'exit b2')
            }
          }
        }
      }
    });

    const [initial] = initialTransition(machine);
    const [before] = transition(machine, initial, { type: 'NEXT' });
    const [next, effects] = transition(machine, before, { type: 'E' });

    expect(next.value).toEqual({ A: 'a1', B: 'b1' });
    expect(effects).toMatchObject([
      { action: record, args: ['exit b2'] },
      { action: record, args: ['entry b1', { version: 1 }] }
    ]);
  });

  it.each([false, true])(
    'only restarts a target region invocation with explicit reentry (reenter: %s)',
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
        if (reenter) {
          expect(actor.getSnapshot().children.worker).not.toBe(child);
          expect(record.mock.calls).toEqual([
            ['exit B'],
            ['stop worker'],
            ['entry B'],
            ['start worker']
          ]);
        } else {
          expect(actor.getSnapshot().children.worker).toBe(child);
          expect(record).not.toHaveBeenCalled();
        }
        record.mockClear();
      } finally {
        actor.stop();
      }
      expect(record.mock.calls).toEqual([['stop worker']]);
    }
  );

  it('preserves the retained region input when another region targets it', () => {
    const record = vi.fn();
    const machine = createMachine({
      id: 'm',
      initial: { target: '#m.P.B', input: { token: 'original' } },
      states: {
        P: {
          type: 'parallel',
          states: {
            A: {
              on: {
                E: {
                  target: '#m.P.B',
                  input: { token: 'replacement' }
                }
              }
            },
            B: {
              initial: 'b1',
              on: { CHECK: ({ input }, enq) => enq(record, input) },
              states: { b1: {} }
            }
          }
        }
      }
    });
    const [initial] = initialTransition(machine);
    const [next] = transition(machine, initial, { type: 'E' });
    const [, effects] = transition(machine, next, { type: 'CHECK' });

    expect(next.value).toEqual({ P: { A: {}, B: 'b1' } });
    expect(effects).toMatchObject([
      { action: record, args: [{ token: 'original' }] }
    ]);
  });

  it('allows independent targeted transitions and targetless transition effects together', () => {
    const record = vi.fn();
    const machine = createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'a1',
          states: {
            a1: {
              on: {
                E: (_, enq) => {
                  enq(record, 'A');
                  return { target: 'a2' };
                }
              }
            },
            a2: {}
          }
        },
        B: {
          initial: 'b1',
          states: {
            b1: {
              on: {
                E: (_, enq) => {
                  enq(record, 'B');
                  return { target: 'b2' };
                }
              }
            },
            b2: {}
          }
        },
        C: { on: { E: (_, enq) => enq(record, 'C') } }
      }
    });
    const [initial] = initialTransition(machine);
    const [next, effects] = transition(machine, initial, { type: 'E' });

    expect(next.value).toEqual({ A: 'a2', B: 'b2', C: {} });
    expect(effects).toMatchObject([
      { action: record, args: ['A'] },
      { action: record, args: ['B'] },
      { action: record, args: ['C'] }
    ]);
  });

  it('keeps nested parallel targets with their active ancestors', () => {
    const machine = createMachine({
      id: 'm',
      initial: 'P',
      states: {
        P: {
          type: 'parallel',
          states: {
            outer: {
              type: 'parallel',
              states: {
                A: { on: { E: { target: '#m.P.outer.B' } } },
                B: { on: { E: { target: '#m.X' } } }
              }
            },
            sibling: {}
          }
        },
        X: {}
      }
    });
    const [initial] = initialTransition(machine);
    const [next] = transition(machine, initial, { type: 'E' });

    expect(next.value).toEqual({
      P: { outer: { A: {}, B: {} }, sibling: {} }
    });
    expect(next.nodes.map((node) => node.id).sort()).toEqual([
      'm',
      'm.P',
      'm.P.outer',
      'm.P.outer.A',
      'm.P.outer.B',
      'm.P.sibling'
    ]);
  });

  it('keeps configurations valid for combinations of atomic-region targets', () => {
    const targets = ['#m.P.A', '#m.P.B', '#m.P.C', '#m.X', undefined];
    for (const targetA of targets) {
      for (const targetB of targets) {
        for (const targetC of targets) {
          const machine = createMachine({
            id: 'm',
            initial: 'P',
            states: {
              P: {
                type: 'parallel',
                states: {
                  A: { on: { E: { target: targetA } } },
                  B: { on: { E: { target: targetB } } },
                  C: { on: { E: { target: targetC } } }
                }
              },
              X: {}
            }
          });
          const [initial] = initialTransition(machine);
          const [next] = transition(machine, initial, { type: 'E' });
          const configuration = next.nodes.map((node) => node.id).sort();

          expect(
            configuration,
            JSON.stringify([targetA, targetB, targetC])
          ).toEqual(
            next.value === 'X'
              ? ['m', 'm.X']
              : ['m', 'm.P', 'm.P.A', 'm.P.B', 'm.P.C']
          );
        }
      }
    }
  });

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

  // Bug 3 — #4793: after a cross-region transition, subsequent events in
  // sibling regions are dropped. Final states are inert, so the transition
  // lives on a non-final state of the region.
  it('sibling region events should still be handled after a cross-region transition', () => {
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
    // A cross-region transition only exits the region containing its
    // targets, so value2 stays 'shown' while value3 advances.
    expect(actor.getSnapshot().value).toEqual({
      value1: 'x',
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
