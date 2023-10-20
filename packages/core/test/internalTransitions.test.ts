import { createMachine, createActor, assign } from '../src/index';
import { trackEntries } from './utils';

describe('internal transitions', () => {
  it('parent state should enter child state without re-entering self', () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          initial: 'a',
          states: {
            a: {},
            b: {}
          },
          on: {
            CLICK: '.b'
          }
        }
      }
    });

    const flushTracked = trackEntries(machine);
    const actor = createActor(machine).start();
    flushTracked();

    actor.send({
      type: 'CLICK'
    });

    expect(actor.getSnapshot().value).toEqual({ foo: 'b' });
    expect(flushTracked()).toEqual(['exit: foo.a', 'enter: foo.b']);
  });

  it('parent state should re-enter self upon transitioning to child state if transition is reentering', () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          initial: 'left',
          states: {
            left: {},
            right: {}
          },
          on: {
            NEXT: {
              target: '.right',
              reenter: true
            }
          }
        }
      }
    });

    const flushTracked = trackEntries(machine);
    const actor = createActor(machine).start();
    flushTracked();

    actor.send({
      type: 'NEXT'
    });

    expect(actor.getSnapshot().value).toEqual({ foo: 'right' });
    expect(flushTracked()).toEqual([
      'exit: foo.left',
      'exit: foo',
      'enter: foo',
      'enter: foo.right'
    ]);
  });

  it('parent state should only exit/reenter if there is an explicit self-transition', () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          initial: 'a',
          states: {
            a: {
              on: {
                NEXT: 'b'
              }
            },
            b: {}
          },
          on: {
            RESET: {
              target: 'foo',
              reenter: true
            }
          }
        }
      }
    });

    const flushTracked = trackEntries(machine);
    const actor = createActor(machine).start();
    actor.send({
      type: 'NEXT'
    });
    flushTracked();

    actor.send({
      type: 'RESET'
    });

    expect(actor.getSnapshot().value).toEqual({ foo: 'a' });
    expect(flushTracked()).toEqual([
      'exit: foo.b',
      'exit: foo',
      'enter: foo',
      'enter: foo.a'
    ]);
  });

  it('parent state should only exit/reenter if there is an explicit self-transition (to child)', () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          initial: 'a',
          states: {
            a: {},
            b: {}
          },
          on: {
            RESET_TO_B: {
              target: 'foo.b',
              reenter: true
            }
          }
        }
      }
    });

    const flushTracked = trackEntries(machine);
    const actor = createActor(machine).start();
    flushTracked();

    actor.send({
      type: 'RESET_TO_B'
    });

    expect(actor.getSnapshot().value).toEqual({ foo: 'b' });
    expect(flushTracked()).toEqual([
      'exit: foo.a',
      'exit: foo',
      'enter: foo',
      'enter: foo.b'
    ]);
  });

  it('should listen to events declared at top state', () => {
    const machine = createMachine({
      initial: 'foo',
      on: {
        CLICKED: '.bar'
      },
      states: {
        foo: {},
        bar: {}
      }
    });
    const actor = createActor(machine).start();
    actor.send({
      type: 'CLICKED'
    });

    expect(actor.getSnapshot().value).toEqual('bar');
  });

  it('should work with targetless transitions (in conditional array)', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            TARGETLESS_ARRAY: [{ actions: [spy] }]
          }
        }
      }
    });
    const actor = createActor(machine).start();
    actor.send({
      type: 'TARGETLESS_ARRAY'
    });
    expect(spy).toHaveBeenCalled();
  });

  it('should work with targetless transitions (in object)', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            TARGETLESS_OBJECT: { actions: [spy] }
          }
        }
      }
    });
    const actor = createActor(machine).start();
    actor.send({
      type: 'TARGETLESS_OBJECT'
    });
    expect(spy).toHaveBeenCalled();
  });

  it('should work on parent with targetless transitions (in conditional array)', () => {
    const spy = jest.fn();
    const machine = createMachine({
      on: {
        TARGETLESS_ARRAY: [{ actions: [spy] }]
      },
      initial: 'foo',
      states: { foo: {} }
    });
    const actor = createActor(machine).start();
    actor.send({
      type: 'TARGETLESS_ARRAY'
    });
    expect(spy).toHaveBeenCalled();
  });

  it('should work on parent with targetless transitions (in object)', () => {
    const spy = jest.fn();
    const machine = createMachine({
      on: {
        TARGETLESS_OBJECT: { actions: [spy] }
      },
      initial: 'foo',
      states: { foo: {} }
    });
    const actor = createActor(machine).start();
    actor.send({
      type: 'TARGETLESS_OBJECT'
    });
    expect(spy).toHaveBeenCalled();
  });

  it('should maintain the child state when targetless transition is handled by parent', () => {
    const machine = createMachine({
      initial: 'foo',
      on: {
        PARENT_EVENT: { actions: () => {} }
      },
      states: {
        foo: {}
      }
    });
    const actor = createActor(machine).start();
    actor.send({
      type: 'PARENT_EVENT'
    });

    expect(actor.getSnapshot().value).toEqual('foo');
  });

  it('should reenter proper descendants of a source state of an internal transition', () => {
    const machine = createMachine({
      types: {} as {
        context: {
          sourceStateEntries: number;
          directDescendantEntries: number;
          deepDescendantEntries: number;
        };
      },
      context: {
        sourceStateEntries: 0,
        directDescendantEntries: 0,
        deepDescendantEntries: 0
      },
      initial: 'a1',
      states: {
        a1: {
          initial: 'a11',
          entry: assign({
            sourceStateEntries: ({ context }) => context.sourceStateEntries + 1
          }),
          states: {
            a11: {
              initial: 'a111',
              entry: assign({
                directDescendantEntries: ({ context }) =>
                  context.directDescendantEntries + 1
              }),
              states: {
                a111: {
                  entry: assign({
                    deepDescendantEntries: ({ context }) =>
                      context.deepDescendantEntries + 1
                  })
                }
              }
            }
          },
          on: {
            REENTER: '.a11.a111'
          }
        }
      }
    });

    const service = createActor(machine).start();

    service.send({ type: 'REENTER' });

    expect(service.getSnapshot().context).toEqual({
      sourceStateEntries: 1,
      directDescendantEntries: 2,
      deepDescendantEntries: 2
    });
  });

  it('should exit proper descendants of a source state of an internal transition', () => {
    const machine = createMachine({
      types: {} as {
        context: {
          sourceStateExits: number;
          directDescendantExits: number;
          deepDescendantExits: number;
        };
      },
      context: {
        sourceStateExits: 0,
        directDescendantExits: 0,
        deepDescendantExits: 0
      },
      initial: 'a1',
      states: {
        a1: {
          initial: 'a11',
          exit: assign({
            sourceStateExits: ({ context }) => context.sourceStateExits + 1
          }),
          states: {
            a11: {
              initial: 'a111',
              exit: assign({
                directDescendantExits: ({ context }) =>
                  context.directDescendantExits + 1
              }),
              states: {
                a111: {
                  exit: assign({
                    deepDescendantExits: ({ context }) =>
                      context.deepDescendantExits + 1
                  })
                }
              }
            }
          },
          on: {
            REENTER: '.a11.a111'
          }
        }
      }
    });

    const service = createActor(machine).start();

    service.send({ type: 'REENTER' });

    expect(service.getSnapshot().context).toEqual({
      sourceStateExits: 0,
      directDescendantExits: 1,
      deepDescendantExits: 1
    });
  });
});
