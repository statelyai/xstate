import {
  AnyInterpreter,
  assign,
  createMachine,
  interpret,
  sendTo
} from '../src/index.js';
import { raise, send, sendParent, stop } from '../src/actions.js';
import { fromCallback } from '../src/actors/index.js';
import { fromPromise } from '../src/actors/index.js';

describe('predictableExec', () => {
  it('should call mixed custom and builtin actions in the definitions order', () => {
    const actual: string[] = [];

    const machine = createMachine({
      initial: 'a',
      context: {},
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
              return {};
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
      entry: () => {
        called = true;
      }
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

    expect(interpret(machine).getSnapshot().context.called).toBe(true);
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
          entry: raise({ type: 'RAISED' })
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
          entry: raise({ type: 'RAISED' })
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
          entry: raise({ type: 'RAISED' })
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
                stop((ctx) => {
                  return ctx.actorRef;
                }),
                assign({
                  actorRef: (_ctx: any, _ev: any, { spawn }: any) => {
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
                  actorRef: (_ctx: any, _ev: any, { spawn }: any) => {
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
                  actorRef: (_ctx: any, _ev: any, { spawn }: any) => {
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
                  actorRef: (_ctx: any, _ev: any, { spawn }: any) => {
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
              external: true
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

  // TODO: if we allow this by flipping [...invokes, ...entry] to [...entry, ...invokes]
  // then we end up with a different problem, we no longer have the ability to target the invoked actor with entry send:
  //
  // invoke: { id: 'a', src: actor },
  // entry: send('EVENT', { to: 'a' })
  //
  // this seems to be even a worse problem. It's likely that we will have to remove this test case and document it as a breaking change.
  // in v4 we are actually deferring sends till the end of the entry block:
  // https://github.com/statelyai/xstate/blob/aad4991b4eb04faf979a0c8a027a5bcf861f34b3/packages/core/src/actions.ts#L703-L704
  //
  // should this be implemented in v5 as well?
  it.skip('should create invoke based on context updated by entry actions of the same state', () => {
    const machine = createMachine({
      context: {
        updated: false
      },
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: assign({ updated: true }),
          invoke: {
            src: (ctx) => {
              expect(ctx.updated).toBe(true);
              return fromPromise(() => Promise.resolve());
            }
          }
        }
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });
  });

  it('should deliver events sent from the entry actions to a service invoked in the same state', () => {
    let received: any;

    const machine = createMachine({
      context: {
        updated: false
      },
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: send({ type: 'KNOCK_KNOCK' }, { to: 'myChild' }),
          invoke: {
            id: 'myChild',
            src: () =>
              fromCallback((_sendBack, onReceive) => {
                onReceive((event) => {
                  received = event;
                });
                return () => {};
              })
          }
        }
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });

    expect(received).toEqual({ type: 'KNOCK_KNOCK' });
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
                guard: () =>
                  service.getSnapshot().children.myChild.getSnapshot().value ===
                  'b',
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

  // https://github.com/statelyai/xstate/issues/3617
  it('should deliver events sent from the exit actions to a service invoked in the same state', (done) => {
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'my-service',
            src: fromCallback((_, onReceive) => {
              onReceive((event) => {
                if (event.type === 'MY_EVENT') {
                  done();
                }
              });
            })
          },
          exit: sendTo('my-service', { type: 'MY_EVENT' }),
          on: {
            TOGGLE: 'inactive'
          }
        },
        inactive: {}
      }
    });

    const actor = interpret(machine).start();

    actor.send({ type: 'TOGGLE' });
  });
});
