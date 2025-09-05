import { z } from 'zod';
import { next_createMachine, createActor } from '../src/index';

describe('internal transitions', () => {
  it('parent state should enter child state without re-entering self', () => {
    const tracked: string[] = [];
    const machine = next_createMachine({
      initial: 'foo',
      states: {
        foo: {
          initial: 'a',
          states: {
            a: {
              entry: (_, enq) => enq(() => tracked.push('enter: foo.a')),
              exit: (_, enq) => enq(() => tracked.push('exit: foo.a'))
            },
            b: {
              entry: (_, enq) => enq(() => tracked.push('enter: foo.b')),
              exit: (_, enq) => enq(() => tracked.push('exit: foo.b'))
            }
          },
          on: {
            CLICK: '.b'
          }
        }
      }
    });

    // const flushTracked = trackEntries(machine);
    const actor = createActor(machine).start();
    // flushTracked();
    tracked.length = 0;

    actor.send({
      type: 'CLICK'
    });

    expect(actor.getSnapshot().value).toEqual({ foo: 'b' });
    expect(tracked).toEqual(['exit: foo.a', 'enter: foo.b']);
  });

  it('parent state should re-enter self upon transitioning to child state if transition is reentering', () => {
    const tracked: string[] = [];
    const machine = next_createMachine({
      initial: 'foo',
      states: {
        foo: {
          entry: (_, enq) => enq(() => tracked.push('enter: foo')),
          exit: (_, enq) => enq(() => tracked.push('exit: foo')),
          initial: 'left',
          states: {
            left: {
              entry: (_, enq) => enq(() => tracked.push('enter: foo.left')),
              exit: (_, enq) => enq(() => tracked.push('exit: foo.left'))
            },
            right: {
              entry: (_, enq) => enq(() => tracked.push('enter: foo.right')),
              exit: (_, enq) => enq(() => tracked.push('exit: foo.right'))
            }
          },
          on: {
            NEXT: () => ({
              target: '.right',
              reenter: true
            })
          }
        }
      }
    });

    const actor = createActor(machine).start();
    tracked.length = 0;

    actor.send({
      type: 'NEXT'
    });

    expect(actor.getSnapshot().value).toEqual({ foo: 'right' });
    expect(tracked).toEqual([
      'exit: foo.left',
      'exit: foo',
      'enter: foo',
      'enter: foo.right'
    ]);
  });

  it('parent state should only exit/reenter if there is an explicit self-transition', () => {
    const tracked: string[] = [];
    const machine = next_createMachine({
      initial: 'foo',
      states: {
        foo: {
          entry: (_, enq) => enq(() => tracked.push('enter: foo')),
          exit: (_, enq) => enq(() => tracked.push('exit: foo')),
          initial: 'a',
          states: {
            a: {
              entry: (_, enq) => enq(() => tracked.push('enter: foo.a')),
              exit: (_, enq) => enq(() => tracked.push('exit: foo.a')),
              on: {
                NEXT: 'b'
              }
            },
            b: {
              entry: (_, enq) => enq(() => tracked.push('enter: foo.b')),
              exit: (_, enq) => enq(() => tracked.push('exit: foo.b'))
            }
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

    const actor = createActor(machine).start();
    actor.send({
      type: 'NEXT'
    });
    tracked.length = 0;

    actor.send({
      type: 'RESET'
    });

    expect(actor.getSnapshot().value).toEqual({ foo: 'a' });
    expect(tracked).toEqual([
      'exit: foo.b',
      'exit: foo',
      'enter: foo',
      'enter: foo.a'
    ]);
  });

  it('parent state should only exit/reenter if there is an explicit self-transition (to child)', () => {
    const tracked: string[] = [];
    const machine = next_createMachine({
      initial: 'foo',
      states: {
        foo: {
          entry: (_, enq) => enq(() => tracked.push('enter: foo')),
          exit: (_, enq) => enq(() => tracked.push('exit: foo')),
          initial: 'a',
          states: {
            a: {
              entry: (_, enq) => enq(() => tracked.push('enter: foo.a')),
              exit: (_, enq) => enq(() => tracked.push('exit: foo.a'))
            },
            b: {
              entry: (_, enq) => enq(() => tracked.push('enter: foo.b')),
              exit: (_, enq) => enq(() => tracked.push('exit: foo.b'))
            }
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

    const actor = createActor(machine).start();
    tracked.length = 0;

    actor.send({
      type: 'RESET_TO_B'
    });

    expect(actor.getSnapshot().value).toEqual({ foo: 'b' });
    expect(tracked).toEqual([
      'exit: foo.a',
      'exit: foo',
      'enter: foo',
      'enter: foo.b'
    ]);
  });

  it('should listen to events declared at top state', () => {
    const machine = next_createMachine({
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
    const spy = vi.fn();
    const machine = next_createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            TARGETLESS_ARRAY: (_, enq) => void enq(spy)
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
    const spy = vi.fn();
    const machine = next_createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            TARGETLESS_OBJECT: (_, enq) => void enq(spy)
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
    const spy = vi.fn();
    const machine = next_createMachine({
      on: {
        TARGETLESS_ARRAY: (_, enq) => void enq(spy)
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
    const spy = vi.fn();
    const machine = next_createMachine({
      on: {
        TARGETLESS_OBJECT: (_, enq) => void enq(spy)
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
    const machine = next_createMachine({
      initial: 'foo',
      on: {
        PARENT_EVENT: (_, enq) => void enq(() => {})
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
    const machine = next_createMachine({
      // types: {} as {
      //   context: {
      //     sourceStateEntries: number;
      //     directDescendantEntries: number;
      //     deepDescendantEntries: number;
      //   };
      // },
      schemas: {
        context: z.object({
          sourceStateEntries: z.number(),
          directDescendantEntries: z.number(),
          deepDescendantEntries: z.number()
        })
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
          entry: ({ context }) => ({
            context: {
              ...context,
              sourceStateEntries: context.sourceStateEntries + 1
            }
          }),
          states: {
            a11: {
              initial: 'a111',
              entry: ({ context }) => ({
                context: {
                  ...context,
                  directDescendantEntries: context.directDescendantEntries + 1
                }
              }),
              states: {
                a111: {
                  entry: ({ context }) => ({
                    context: {
                      ...context,
                      deepDescendantEntries: context.deepDescendantEntries + 1
                    }
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

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().context).toEqual({
      sourceStateEntries: 1,
      directDescendantEntries: 1,
      deepDescendantEntries: 1
    });

    actor.send({ type: 'REENTER' });

    expect(actor.getSnapshot().context).toEqual({
      sourceStateEntries: 1,
      directDescendantEntries: 2,
      deepDescendantEntries: 2
    });
  });

  it('should exit proper descendants of a source state of an internal transition', () => {
    const machine = next_createMachine({
      // types: {} as {
      //   context: {
      //     sourceStateExits: number;
      //     directDescendantExits: number;
      //     deepDescendantExits: number;
      //   };
      // },
      schemas: {
        context: z.object({
          sourceStateExits: z.number(),
          directDescendantExits: z.number(),
          deepDescendantExits: z.number()
        })
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
          exit: ({ context }) => ({
            context: {
              ...context,
              sourceStateExits: context.sourceStateExits + 1
            }
          }),
          states: {
            a11: {
              initial: 'a111',
              exit: ({ context }) => ({
                context: {
                  ...context,
                  directDescendantExits: context.directDescendantExits + 1
                }
              }),
              states: {
                a111: {
                  exit: ({ context }) => {
                    console.log('a111 exit');
                    return {
                      context: {
                        ...context,
                        deepDescendantExits: context.deepDescendantExits + 1
                      }
                    };
                  }
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

    const actor = createActor(machine).start();

    actor.send({ type: 'REENTER' });

    expect(actor.getSnapshot().context).toEqual({
      sourceStateExits: 0,
      directDescendantExits: 1,
      deepDescendantExits: 1
    });
  });
});
