import {
  createMachine,
  createActor,
  assign,
  AnyActorRef,
  sendParent
} from '../src/index.ts';
import { trackEntries } from './utils.ts';

describe('final states', () => {
  it('status of a machine with a root state being final should be done', () => {
    const machine = createMachine({ type: 'final' });
    const actorRef = createActor(machine).start();

    expect(actorRef.getSnapshot().status).toBe('done');
  });
  it('output of a machine with a root state being final should be called with a "xstate.done.state.ROOT_ID" event', () => {
    const spy = jest.fn();
    const machine = createMachine({
      type: 'final',
      output: ({ event }) => {
        spy(event);
      }
    });
    createActor(machine, { input: 42 }).start();

    expect(spy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "output": undefined,
            "type": "xstate.done.state.(machine)",
          },
        ],
      ]
    `);
  });
  it('should emit the "xstate.done.state.*" event when all nested states are in their final states', () => {
    const onDoneSpy = jest.fn();

    const machine = createMachine({
      id: 'm',
      initial: 'foo',
      states: {
        foo: {
          type: 'parallel',
          states: {
            first: {
              initial: 'a',
              states: {
                a: {
                  on: { NEXT_1: 'b' }
                },
                b: {
                  type: 'final'
                }
              }
            },
            second: {
              initial: 'a',
              states: {
                a: {
                  on: { NEXT_2: 'b' }
                },
                b: {
                  type: 'final'
                }
              }
            }
          },
          onDone: {
            target: 'bar',
            actions: ({ event }) => {
              onDoneSpy(event.type);
            }
          }
        },
        bar: {}
      }
    });

    const actor = createActor(machine).start();

    actor.send({
      type: 'NEXT_1'
    });
    actor.send({
      type: 'NEXT_2'
    });

    expect(actor.getSnapshot().value).toBe('bar');
    expect(onDoneSpy).toHaveBeenCalledWith('xstate.done.state.m.foo');
  });

  it('should execute final child state actions first', () => {
    const actual: string[] = [];
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          initial: 'bar',
          onDone: { actions: () => actual.push('fooAction') },
          states: {
            bar: {
              initial: 'baz',
              onDone: 'barFinal',
              states: {
                baz: {
                  type: 'final',
                  entry: () => actual.push('bazAction')
                }
              }
            },
            barFinal: {
              type: 'final',
              entry: () => actual.push('barAction')
            }
          }
        }
      }
    });

    createActor(machine).start();

    expect(actual).toEqual(['bazAction', 'barAction', 'fooAction']);
  });

  it('should call output expressions on nested final nodes', (done) => {
    interface Ctx {
      revealedSecret?: string;
    }

    const machine = createMachine({
      types: {} as { context: Ctx },
      initial: 'secret',
      context: {
        revealedSecret: undefined
      },
      states: {
        secret: {
          initial: 'wait',
          states: {
            wait: {
              on: {
                REQUEST_SECRET: 'reveal'
              }
            },
            reveal: {
              type: 'final',
              output: () => ({
                secret: 'the secret'
              })
            }
          },
          onDone: {
            target: 'success',
            actions: assign({
              revealedSecret: ({ event }) => {
                return (event.output as any).secret;
              }
            })
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine);
    service.subscribe({
      complete: () => {
        expect(service.getSnapshot().context).toEqual({
          revealedSecret: 'the secret'
        });
        done();
      }
    });
    service.start();

    service.send({ type: 'REQUEST_SECRET' });
  });

  it("should only call data expression once when entering root's final state", () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            FINISH: 'end'
          }
        },
        end: {
          type: 'final'
        }
      },
      output: spy
    });

    const service = createActor(machine).start();
    service.send({ type: 'FINISH', value: 1 });
    expect(spy).toBeCalledTimes(1);
  });

  it('output mapper should receive self', () => {
    const machine = createMachine({
      types: {
        output: {} as {
          selfRef: AnyActorRef;
        }
      },
      initial: 'done',
      states: {
        done: {
          type: 'final'
        }
      },
      output: ({ self }) => ({ selfRef: self })
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().output!.selfRef.send).toBeDefined();
  });

  it('state output should be able to use context updated by the entry action of the reached final state', () => {
    const spy = jest.fn();
    const machine = createMachine({
      context: {
        count: 0
      },
      initial: 'a',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {
              on: {
                NEXT: 'a2'
              }
            },
            a2: {
              type: 'final',
              entry: assign({
                count: 1
              }),
              output: ({ context }) => context.count
            }
          },
          onDone: {
            actions: ({ event }) => {
              spy(event.output);
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });

    expect(spy).toHaveBeenCalledWith(1);
  });

  it('should emit a done state event for a parallel state when its parallel children reach their final states', () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          type: 'parallel',
          states: {
            alpha: {
              type: 'parallel',
              states: {
                one: {
                  initial: 'start',
                  states: {
                    start: {
                      on: {
                        finish_one_alpha: 'finish'
                      }
                    },
                    finish: {
                      type: 'final'
                    }
                  }
                },
                two: {
                  initial: 'start',
                  states: {
                    start: {
                      on: {
                        finish_two_alpha: 'finish'
                      }
                    },
                    finish: {
                      type: 'final'
                    }
                  }
                }
              }
            },
            beta: {
              type: 'parallel',
              states: {
                third: {
                  initial: 'start',
                  states: {
                    start: {
                      on: {
                        finish_three_beta: 'finish'
                      }
                    },
                    finish: {
                      type: 'final'
                    }
                  }
                },
                fourth: {
                  initial: 'start',
                  states: {
                    start: {
                      on: {
                        finish_four_beta: 'finish'
                      }
                    },
                    finish: {
                      type: 'final'
                    }
                  }
                }
              }
            }
          },
          onDone: 'done'
        },
        done: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({
      type: 'finish_one_alpha'
    });
    actorRef.send({
      type: 'finish_two_alpha'
    });
    actorRef.send({
      type: 'finish_three_beta'
    });
    actorRef.send({
      type: 'finish_four_beta'
    });

    expect(actorRef.getSnapshot().status).toBe('done');
  });

  it('should emit a done state event for a parallel state when its compound child reaches its final state when the other parallel child region is already in its final state', () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          type: 'parallel',
          states: {
            alpha: {
              type: 'parallel',
              states: {
                one: {
                  initial: 'start',
                  states: {
                    start: {
                      on: {
                        finish_one_alpha: 'finish'
                      }
                    },
                    finish: {
                      type: 'final'
                    }
                  }
                },
                two: {
                  initial: 'start',
                  states: {
                    start: {
                      on: {
                        finish_two_alpha: 'finish'
                      }
                    },
                    finish: {
                      type: 'final'
                    }
                  }
                }
              }
            },
            beta: {
              initial: 'three',
              states: {
                three: {
                  on: {
                    finish_beta: 'finish'
                  }
                },
                finish: {
                  type: 'final'
                }
              }
            }
          },
          onDone: 'done'
        },
        done: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine).start();

    // reach final state of a parallel state
    actorRef.send({
      type: 'finish_one_alpha'
    });
    actorRef.send({
      type: 'finish_two_alpha'
    });

    // reach final state of a compound state
    actorRef.send({
      type: 'finish_beta'
    });

    expect(actorRef.getSnapshot().status).toBe('done');
  });

  it('should emit a done state event for a parallel state when its parallel child reaches its final state when the other compound child region is already in its final state', () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          type: 'parallel',
          states: {
            alpha: {
              type: 'parallel',
              states: {
                one: {
                  initial: 'start',
                  states: {
                    start: {
                      on: {
                        finish_one_alpha: 'finish'
                      }
                    },
                    finish: {
                      type: 'final'
                    }
                  }
                },
                two: {
                  initial: 'start',
                  states: {
                    start: {
                      on: {
                        finish_two_alpha: 'finish'
                      }
                    },
                    finish: {
                      type: 'final'
                    }
                  }
                }
              }
            },
            beta: {
              initial: 'three',
              states: {
                three: {
                  on: {
                    finish_beta: 'finish'
                  }
                },
                finish: {
                  type: 'final'
                }
              }
            }
          },
          onDone: 'done'
        },
        done: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine).start();

    // reach final state of a compound state
    actorRef.send({
      type: 'finish_beta'
    });

    // reach final state of a parallel state
    actorRef.send({
      type: 'finish_one_alpha'
    });
    actorRef.send({
      type: 'finish_two_alpha'
    });

    expect(actorRef.getSnapshot().status).toBe('done');
  });

  it('should reach a final state when a parallel state reaches its final state and transitions to a top-level final state in response to that', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          type: 'parallel',
          onDone: 'b',
          states: {
            a1: {
              type: 'parallel',
              states: {
                a1a: { type: 'final' },
                a1b: { type: 'final' }
              }
            },
            a2: {
              initial: 'a2a',
              states: { a2a: { type: 'final' } }
            }
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine).start();

    expect(actorRef.getSnapshot().status).toEqual('done');
  });

  it('should reach a final state when a parallel state nested in a parallel state reaches its final state and transitions to a top-level final state in response to that', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          type: 'parallel',
          onDone: 'b',
          states: {
            a1: {
              type: 'parallel',
              states: {
                a1a: { type: 'final' },
                a1b: { type: 'final' }
              }
            },
            a2: {
              initial: 'a2a',
              states: { a2a: { type: 'final' } }
            }
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const actorRef = createActor(machine).start();

    expect(actorRef.getSnapshot().status).toEqual('done');
  });
  it('root output should be called with a "xstate.done.state.*" event of the parallel root when a direct final child of that parallel root is reached', () => {
    const spy = jest.fn();
    const machine = createMachine({
      type: 'parallel',
      states: {
        a: {
          type: 'final'
        }
      },
      output: ({ event }) => {
        spy(event);
      }
    });

    createActor(machine).start();

    expect(spy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "output": undefined,
            "type": "xstate.done.state.(machine)",
          },
        ],
      ]
    `);
  });

  it('root output should be called with a "xstate.done.state.*" event of the parallel root when a final child of its compound child is reached', () => {
    const spy = jest.fn();
    const machine = createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'b',
          states: {
            b: {
              type: 'final'
            }
          }
        }
      },
      output: ({ event }) => {
        spy(event);
      }
    });

    createActor(machine).start();

    expect(spy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "output": undefined,
            "type": "xstate.done.state.(machine)",
          },
        ],
      ]
    `);
  });

  it('root output should be called with a "xstate.done.state.*" event of the parallel root when a final descendant is reached 2 parallel levels deep', () => {
    const spy = jest.fn();
    const machine = createMachine({
      type: 'parallel',
      states: {
        a: {
          type: 'parallel',
          states: {
            b: {
              initial: 'c',
              states: {
                c: {
                  type: 'final'
                }
              }
            }
          }
        }
      },
      output: ({ event }) => {
        spy(event);
      }
    });

    createActor(machine).start();

    expect(spy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "output": undefined,
            "type": "xstate.done.state.(machine)",
          },
        ],
      ]
    `);
  });

  it('onDone of an outer parallel state should be called with its own "xstate.done.state.*" event when its direct parallel child completes', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          type: 'parallel',
          states: {
            b: {
              type: 'parallel',
              states: {
                c: {
                  initial: 'd',
                  states: {
                    d: {
                      type: 'final'
                    }
                  }
                }
              }
            }
          },
          onDone: {
            actions: ({ event }) => {
              spy(event);
            }
          }
        }
      }
    });
    createActor(machine).start();

    expect(spy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "output": undefined,
            "type": "xstate.done.state.(machine).a",
          },
        ],
      ]
    `);
  });

  it('onDone should not be called when the machine reaches its final state', () => {
    const spy = jest.fn();
    const machine = createMachine({
      type: 'parallel',
      states: {
        a: {
          type: 'parallel',
          states: {
            b: {
              initial: 'c',
              states: {
                c: {
                  type: 'final'
                }
              },
              onDone: {
                actions: spy
              }
            }
          },
          onDone: {
            actions: spy
          }
        }
      },
      onDone: {
        actions: spy
      }
    });
    createActor(machine).start();

    expect(spy).not.toHaveBeenCalled();
  });

  it('machine should not complete when a parallel child of a compound state completes', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          type: 'parallel',
          states: {
            b: {
              initial: 'c',
              states: {
                c: {
                  type: 'final'
                }
              }
            }
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    expect(actorRef.getSnapshot().status).toBe('active');
  });

  it('root output should only be called once when multiple parallel regions complete at once', () => {
    const spy = jest.fn();

    const machine = createMachine({
      type: 'parallel',
      states: {
        a: {
          type: 'final'
        },
        b: {
          type: 'final'
        }
      },
      output: spy
    });

    createActor(machine).start();

    expect(spy).toBeCalledTimes(1);
  });

  it('onDone of a parallel state should only be called once when multiple parallel regions complete at once', () => {
    const spy = jest.fn();

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          type: 'parallel',
          states: {
            b: {
              type: 'final'
            },
            c: {
              type: 'final'
            }
          },
          onDone: {
            actions: spy
          }
        }
      }
    });

    createActor(machine).start();

    expect(spy).toBeCalledTimes(1);
  });

  it('should call exit actions in reversed document order when the machines reaches its final state', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EV: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const flushTracked = trackEntries(machine);

    const actorRef = createActor(machine).start();
    flushTracked();

    // it's important to send an event here that results in a transition that computes new `state._nodes`
    // and that could impact the order in which exit actions are called
    actorRef.send({ type: 'EV' });

    expect(flushTracked()).toEqual([
      // result of the transition
      'exit: a',
      'enter: b',
      // result of reaching final states
      'exit: b',
      'exit: __root__'
    ]);
  });

  it('should call exit actions of parallel states in reversed document order when the machines reaches its final state after earlier region transition', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'child_a1',
          states: {
            child_a1: {
              on: {
                EV2: 'child_a2'
              }
            },
            child_a2: {
              type: 'final'
            }
          }
        },
        b: {
          initial: 'child_b1',
          states: {
            child_b1: {
              on: {
                EV1: 'child_b2'
              }
            },
            child_b2: {
              type: 'final'
            }
          }
        }
      }
    });

    const flushTracked = trackEntries(machine);

    const actorRef = createActor(machine).start();

    // it's important to send an event here that results in a transition as that computes new `state._nodes`
    // and that could impact the order in which exit actions are called
    actorRef.send({ type: 'EV1' });
    flushTracked();
    actorRef.send({ type: 'EV2' });

    expect(flushTracked()).toEqual([
      // result of the transition
      'exit: a.child_a1',
      'enter: a.child_a2',
      // result of reaching final states
      'exit: b.child_b2',
      'exit: b',
      'exit: a.child_a2',
      'exit: a',
      'exit: __root__'
    ]);
  });

  it('should call exit actions of parallel states in reversed document order when the machines reaches its final state after later region transition', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'child_a1',
          states: {
            child_a1: {
              on: {
                EV2: 'child_a2'
              }
            },
            child_a2: {
              type: 'final'
            }
          }
        },
        b: {
          initial: 'child_b1',
          states: {
            child_b1: {
              on: {
                EV1: 'child_b2'
              }
            },
            child_b2: {
              type: 'final'
            }
          }
        }
      }
    });

    const flushTracked = trackEntries(machine);

    const actorRef = createActor(machine).start();
    // it's important to send an event here that results in a transition as that computes new `state._nodes`
    // and that could impact the order in which exit actions are called
    actorRef.send({ type: 'EV1' });
    flushTracked();
    actorRef.send({ type: 'EV2' });

    expect(flushTracked()).toEqual([
      // result of the transition
      'exit: a.child_a1',
      'enter: a.child_a2',
      // result of reaching final states
      'exit: b.child_b2',
      'exit: b',
      'exit: a.child_a2',
      'exit: a',
      'exit: __root__'
    ]);
  });

  it('should call exit actions of parallel states in reversed document order when the machines reaches its final state after multiple regions transition', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'child_a1',
          states: {
            child_a1: {
              on: {
                EV: 'child_a2'
              }
            },
            child_a2: {
              type: 'final'
            }
          }
        },
        b: {
          initial: 'child_b1',
          states: {
            child_b1: {
              on: {
                EV: 'child_b2'
              }
            },
            child_b2: {
              type: 'final'
            }
          }
        }
      }
    });

    const flushTracked = trackEntries(machine);

    const actorRef = createActor(machine).start();
    flushTracked();
    // it's important to send an event here that results in a transition as that computes new `state._nodes`
    // and that could impact the order in which exit actions are called
    actorRef.send({ type: 'EV' });

    expect(flushTracked()).toEqual([
      // result of the transition
      'exit: b.child_b1',
      'exit: a.child_a1',
      'enter: a.child_a2',
      'enter: b.child_b2',
      // result of reaching final states
      'exit: b.child_b2',
      'exit: b',
      'exit: a.child_a2',
      'exit: a',
      'exit: __root__'
    ]);
  });

  it('should not complete a parallel root immediately when only some of its regions are in their final states (final state reached in a compound region)', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A1',
          states: {
            A1: {
              type: 'final'
            }
          }
        },
        B: {
          initial: 'B1',
          states: {
            B1: {},
            B2: {
              type: 'final'
            }
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    expect(actorRef.getSnapshot().status).toBe('active');
  });

  it('should not complete a parallel root immediately when only some of its regions are in their final states (a direct final child state reached)', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        A: {
          type: 'final'
        },
        B: {
          initial: 'B1',
          states: {
            B1: {},
            B2: {
              type: 'final'
            }
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    expect(actorRef.getSnapshot().status).toBe('active');
  });

  it('should not resolve output of a final state if its parent is a parallel state', () => {
    const spy = jest.fn();

    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          type: 'parallel',
          states: {
            B: {
              type: 'final',
              output: spy
            },
            C: {
              initial: 'C1',
              states: {
                C1: {}
              }
            }
          }
        }
      }
    });

    createActor(machine).start();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should only call exit actions once when a child machine reaches its final state and sends an event to its parent that ends up stopping that child', () => {
    const spy = jest.fn();

    const child = createMachine({
      initial: 'start',
      exit: spy,
      states: {
        start: {
          on: {
            CANCEL: 'canceled'
          }
        },
        canceled: {
          type: 'final',
          entry: sendParent({ type: 'CHILD_CANCELED' })
        }
      }
    });
    const parent = createMachine({
      initial: 'start',
      states: {
        start: {
          invoke: {
            id: 'child',
            src: child,
            onDone: 'completed'
          },
          on: {
            CHILD_CANCELED: 'canceled'
          }
        },
        canceled: {},
        completed: {}
      }
    });

    const actorRef = createActor(parent).start();

    actorRef.getSnapshot().children.child.send({
      type: 'CANCEL'
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should deliver final outgoing events (from final entry action) to the parent before delivering the `xstate.done.actor.*` event', () => {
    const child = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            CANCEL: 'canceled'
          }
        },
        canceled: {
          type: 'final',
          entry: sendParent({ type: 'CHILD_CANCELED' })
        }
      }
    });
    const parent = createMachine({
      initial: 'start',
      states: {
        start: {
          invoke: {
            id: 'child',
            src: child,
            onDone: 'completed'
          },
          on: {
            CHILD_CANCELED: 'canceled'
          }
        },
        canceled: {},
        completed: {}
      }
    });

    const actorRef = createActor(parent).start();

    actorRef.getSnapshot().children.child.send({
      type: 'CANCEL'
    });

    // if `xstate.done.actor.*` would be delivered first the value would be `completed`
    expect(actorRef.getSnapshot().value).toBe('canceled');
  });

  it('should deliver final outgoing events (from root exit action) to the parent before delivering the `xstate.done.actor.*` event', () => {
    const child = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            CANCEL: 'canceled'
          }
        },
        canceled: {
          type: 'final'
        }
      },
      exit: sendParent({ type: 'CHILD_CANCELED' })
    });
    const parent = createMachine({
      initial: 'start',
      states: {
        start: {
          invoke: {
            id: 'child',
            src: child,
            onDone: 'completed'
          },
          on: {
            CHILD_CANCELED: 'canceled'
          }
        },
        canceled: {},
        completed: {}
      }
    });

    const actorRef = createActor(parent).start();

    actorRef.getSnapshot().children.child.send({
      type: 'CANCEL'
    });

    // if `xstate.done.actor.*` would be delivered first the value would be `completed`
    expect(actorRef.getSnapshot().value).toBe('canceled');
  });
});
