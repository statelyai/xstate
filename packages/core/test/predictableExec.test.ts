import { createMachine, interpret, assign, AnyInterpreter } from '../src';
import { raise, send, sendParent, stop } from '../src/actions';
import { fromCallback } from '../src/actors';

describe('predictableExec', () => {
  it('should call mixed custom and builtin actions in the definitions order', () => {
    const actual: string[] = [];

    const machine = createMachine({
      initial: 'a',
      context: {
        assigned: false
      },
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          entry: [
            () => {
              actual.push('custom');
            },
            assign(() => {
              actual.push('assign');
              return {
                assigned: true
              };
            })
          ]
        }
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });

    expect(actual).toEqual(['custom', 'assign']);
  });

  it('should call initial custom actions when starting a service', () => {
    let called = false;
    const machine = createMachine({
      context: {
        initialized: false
      },
      entry: [
        () => {
          called = true;
        },
        assign({
          initialized: true
        })
      ]
    });

    expect(called).toBe(false);

    interpret(machine).start();

    expect(called).toBe(true);
  });

  it('should resolve initial assign actions before starting a service', () => {
    const machine = createMachine({
      context: {
        called: false
      },
      entry: [
        assign({
          called: true
        })
      ]
    });

    expect(interpret(machine).getInitialState().context.called).toBe(true);
  });

  it('should call raised transition custom actions with raised event', () => {
    let eventArg: any;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            RAISED: {
              target: 'c',
              actions: (_ctx, ev) => (eventArg = ev)
            }
          },
          entry: raise('RAISED')
        },
        c: {}
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });

    expect(eventArg.type).toBe('RAISED');
  });

  it('should call raised transition builtin actions with raised event', () => {
    let eventArg: any;
    const machine = createMachine({
      context: {},
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            RAISED: {
              target: 'c',
              actions: assign((_ctx, ev) => {
                eventArg = ev;
                return {};
              })
            }
          },
          entry: raise('RAISED')
        },
        c: {}
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });

    expect(eventArg.type).toBe('RAISED');
  });

  it('should call invoke creator with raised event', () => {
    let eventArg: any;
    const machine = createMachine({
      context: {},
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            RAISED: 'c'
          },
          entry: raise('RAISED')
        },
        c: {
          invoke: {
            src: (_ctx, ev) => {
              eventArg = ev;
              return fromCallback(() => {});
            }
          }
        }
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });

    expect(eventArg.type).toBe('RAISED');
  });

  it('invoked child should be available on the new state', () => {
    const machine = createMachine({
      context: {},
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          invoke: {
            id: 'myChild',
            src: fromCallback(() => {})
          }
        }
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });

    expect(service.getSnapshot().children.myChild).toBeDefined();
  });

  it('invoked child should not be available on the state after leaving invoking state', () => {
    const machine = createMachine({
      context: {},
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          invoke: {
            id: 'myChild',
            src: fromCallback(() => {})
          },
          on: {
            NEXT: 'c'
          }
        },
        c: {}
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });
    service.send({ type: 'NEXT' });

    expect(service.getSnapshot().children.myChild).not.toBeDefined();
  });

  it('should correctly provide intermediate context value to a custom action executed in between assign actions', () => {
    let calledWith = 0;
    const machine = createMachine({
      context: {
        counter: 0
      },
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: [
            assign({ counter: 1 }),
            (context) => (calledWith = context.counter),
            assign({ counter: 2 })
          ]
        }
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });

    expect(calledWith).toBe(1);
  });

  it('should be able to restart a spawned actor within a single macrostep', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = createMachine({
      initial: 'active',
      context: ({ spawn }) => {
        const localId = ++invokeCounter;

        return {
          actorRef: spawn(
            fromCallback(() => {
              actual.push(`start ${localId}`);
              return () => {
                actual.push(`stop ${localId}`);
              };
            }),
            'callback-1'
          )
        };
      },
      states: {
        active: {
          on: {
            update: {
              actions: [
                stop((ctx: any) => {
                  return ctx.actorRef;
                }),
                assign({
                  actorRef: (_ctx, _ev, { spawn }) => {
                    const localId = ++invokeCounter;

                    return spawn(
                      fromCallback(() => {
                        actual.push(`start ${localId}`);
                        return () => {
                          actual.push(`stop ${localId}`);
                        };
                      }),
                      'callback-2'
                    );
                  }
                })
              ]
            }
          }
        }
      }
    });

    const service = interpret(machine).start();

    actual.length = 0;

    service.send({
      type: 'update'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });

  it('should be able to restart a named spawned actor within a single macrostep when stopping by ref', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = createMachine({
      initial: 'active',
      context: ({ spawn }) => {
        const localId = ++invokeCounter;

        return {
          actorRef: spawn(
            fromCallback(() => {
              actual.push(`start ${localId}`);
              return () => {
                actual.push(`stop ${localId}`);
              };
            }),
            'my_name'
          )
        };
      },
      states: {
        active: {
          on: {
            update: {
              actions: [
                stop((ctx) => ctx.actorRef),
                assign({
                  actorRef: (_ctx, _ev, { spawn }) => {
                    const localId = ++invokeCounter;

                    return spawn(
                      fromCallback(() => {
                        actual.push(`start ${localId}`);
                        return () => {
                          actual.push(`stop ${localId}`);
                        };
                      }),
                      'my_name'
                    );
                  }
                })
              ]
            }
          }
        }
      }
    });

    const service = interpret(machine).start();

    actual.length = 0;

    service.send({
      type: 'update'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });

  it('should be able to restart a named spawned actor within a single macrostep when stopping by static name', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = createMachine({
      initial: 'active',
      context: ({ spawn }) => {
        const localId = ++invokeCounter;

        return {
          actorRef: spawn(
            fromCallback(() => {
              actual.push(`start ${localId}`);
              return () => {
                actual.push(`stop ${localId}`);
              };
            }),
            'my_name'
          )
        };
      },
      states: {
        active: {
          on: {
            update: {
              actions: [
                stop('my_name'),
                assign({
                  actorRef: (_ctx, _ev, { spawn }) => {
                    const localId = ++invokeCounter;

                    return spawn(
                      fromCallback(() => {
                        actual.push(`start ${localId}`);
                        return () => {
                          actual.push(`stop ${localId}`);
                        };
                      }),
                      'my_name'
                    );
                  }
                })
              ]
            }
          }
        }
      }
    });

    const service = interpret(machine).start();

    actual.length = 0;

    service.send({
      type: 'update'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });

  it('should be able to restart a named spawned actor within a single macrostep when stopping by resolved name', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = createMachine({
      initial: 'active',
      context: ({ spawn }) => {
        const localId = ++invokeCounter;
        actual.push(`start ${localId}`);

        return {
          actorRef: spawn(
            fromCallback(() => {
              return () => {
                actual.push(`stop ${localId}`);
              };
            }),
            'my_name'
          )
        };
      },
      states: {
        active: {
          on: {
            update: {
              actions: [
                stop(() => 'my_name'),
                assign({
                  actorRef: (_ctx, _ev, { spawn }) => {
                    const localId = ++invokeCounter;

                    return spawn(
                      fromCallback(() => {
                        actual.push(`start ${localId}`);
                        return () => {
                          actual.push(`stop ${localId}`);
                        };
                      }),
                      'my_name'
                    );
                  }
                })
              ]
            }
          }
        }
      }
    });

    const service = interpret(machine).start();

    actual.length = 0;

    service.send({
      type: 'update'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });

  it('should be able to restart an invoke when reentering the invoking state', () => {
    const actual: string[] = [];
    let invokeCounter = 0;

    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: { ACTIVATE: 'active' }
        },
        active: {
          invoke: {
            src: () => {
              return fromCallback(() => {
                const localId = ++invokeCounter;
                actual.push(`start ${localId}`);
                return () => {
                  actual.push(`stop ${localId}`);
                };
              });
            }
          },
          on: {
            REENTER: {
              target: 'active',
              internal: false
            }
          }
        }
      }
    });

    const service = interpret(machine).start();

    service.send({
      type: 'ACTIVATE'
    });

    actual.length = 0;

    service.send({
      type: 'REENTER'
    });

    expect(actual).toEqual(['stop 1', 'start 2']);
  });

  it('initial actions should receive context updated only by preceeding assign actions', () => {
    const actual: number[] = [];

    const machine = createMachine({
      context: { count: 0 },
      entry: [
        (ctx) => actual.push(ctx.count),
        assign({ count: 1 }),
        (ctx) => actual.push(ctx.count),
        assign({ count: 2 }),
        (ctx) => actual.push(ctx.count)
      ]
    });

    interpret(machine).start();

    expect(actual).toEqual([0, 1, 2]);
  });

  it('parent should be able to read the updated state of a child when receiving an event from it', (done) => {
    const child = createMachine({
      initial: 'a',
      states: {
        a: {
          // we need to clear the call stack before we send the event to the parent
          after: {
            1: 'b'
          }
        },
        b: {
          entry: sendParent({ type: 'CHILD_UPDATED' })
        }
      }
    });

    let service: AnyInterpreter;

    const machine = createMachine({
      invoke: {
        id: 'myChild',
        src: child
      },
      initial: 'initial',
      states: {
        initial: {
          on: {
            CHILD_UPDATED: [
              {
                guard: () => {
                  return (
                    service.getSnapshot().children.myChild.getSnapshot()
                      .value === 'b'
                  );
                },
                target: 'success'
              },
              {
                target: 'fail'
              }
            ]
          }
        },
        success: {
          type: 'final'
        },
        fail: {
          type: 'final'
        }
      }
    });

    service = interpret(machine)
      .onDone(() => {
        expect(service.getSnapshot().value).toBe('success');
        done();
      })
      .start();
  });

  it('should be possible to send immediate events to initially invoked actors', () => {
    const child = createMachine({
      on: {
        PING: {
          actions: sendParent({ type: 'PONG' })
        }
      }
    });

    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          invoke: {
            id: 'ponger',
            src: child
          },
          entry: send({ type: 'PING' }, { to: 'ponger' }),
          on: {
            PONG: 'done'
          }
        },
        done: {
          type: 'final'
        }
      }
    });

    const service = interpret(machine).start();

    expect(service.getSnapshot().value).toBe('done');
  });
});
