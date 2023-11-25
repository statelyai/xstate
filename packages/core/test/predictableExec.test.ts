import {
  createMachine,
  interpret,
  assign,
  spawn,
  AnyInterpreter,
  sendTo
} from '../src';
import { raise, stop, send, sendParent } from '../src/actions';

describe('predictableExec', () => {
  it('should call mixed custom and builtin actions in the definitions order', () => {
    const actual: string[] = [];

    const machine = createMachine({
      initial: 'a',
      context: {},
      predictableActionArguments: true,
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
      predictableActionArguments: true,
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
      predictableActionArguments: true,
      context: {
        called: false
      },
      entry: [
        assign({
          called: true
        })
      ]
    });

    expect(interpret(machine).initialState.context.called).toBe(true);
  });

  it('should call raised transition custom actions with raised event', () => {
    let eventArg: any;
    const machine = createMachine({
      predictableActionArguments: true,
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
      predictableActionArguments: true,
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
      predictableActionArguments: true,
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
              return () => {};
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
      predictableActionArguments: true,
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
            src: () => () => {}
          }
        }
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'NEXT' });

    expect(service.state.children.myChild).toBeDefined();
  });

  it('invoked child should not be available on the state after leaving invoking state', () => {
    const machine = createMachine({
      predictableActionArguments: true,
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
            src: () => () => {}
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

    expect(service.state.children.myChild).not.toBeDefined();
  });

  it('should automatically enable preserveActionOrder', () => {
    let calledWith = 0;
    const machine = createMachine({
      predictableActionArguments: true,
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

    const machine = createMachine<any, any>({
      predictableActionArguments: true,
      initial: 'active',
      context: () => {
        const localId = ++invokeCounter;
        actual.push(`start ${localId}`);

        return {
          actorRef: spawn(() => {
            return () => {
              actual.push(`stop ${localId}`);
            };
          })
        };
      },
      states: {
        active: {
          on: {
            update: {
              actions: [
                stop((ctx: any) => ctx.actorRef),
                assign({
                  actorRef: () => {
                    const localId = ++invokeCounter;
                    actual.push(`start ${localId}`);

                    return spawn(() => {
                      return () => {
                        actual.push(`stop ${localId}`);
                      };
                    });
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

    const machine = createMachine<any, any>({
      predictableActionArguments: true,
      initial: 'active',
      context: () => {
        const localId = ++invokeCounter;
        actual.push(`start ${localId}`);

        return {
          actorRef: spawn(() => {
            return () => {
              actual.push(`stop ${localId}`);
            };
          }, 'my_name')
        };
      },
      states: {
        active: {
          on: {
            update: {
              actions: [
                stop((ctx: any) => ctx.actorRef),
                assign({
                  actorRef: () => {
                    const localId = ++invokeCounter;
                    actual.push(`start ${localId}`);

                    return spawn(() => {
                      return () => {
                        actual.push(`stop ${localId}`);
                      };
                    }, 'my_name');
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

    const machine = createMachine<any, any>({
      predictableActionArguments: true,
      initial: 'active',
      context: () => {
        const localId = ++invokeCounter;
        actual.push(`start ${localId}`);

        return {
          actorRef: spawn(() => {
            return () => {
              actual.push(`stop ${localId}`);
            };
          }, 'my_name')
        };
      },
      states: {
        active: {
          on: {
            update: {
              actions: [
                stop('my_name'),
                assign({
                  actorRef: () => {
                    const localId = ++invokeCounter;
                    actual.push(`start ${localId}`);

                    return spawn(() => {
                      return () => {
                        actual.push(`stop ${localId}`);
                      };
                    }, 'my_name');
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

    const machine = createMachine<any, any>({
      predictableActionArguments: true,
      initial: 'active',
      context: () => {
        const localId = ++invokeCounter;
        actual.push(`start ${localId}`);

        return {
          actorRef: spawn(() => {
            return () => {
              actual.push(`stop ${localId}`);
            };
          }, 'my_name')
        };
      },
      states: {
        active: {
          on: {
            update: {
              actions: [
                stop(() => 'my_name'),
                assign({
                  actorRef: () => {
                    const localId = ++invokeCounter;
                    actual.push(`start ${localId}`);

                    return spawn(() => {
                      return () => {
                        actual.push(`stop ${localId}`);
                      };
                    }, 'my_name');
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
      predictableActionArguments: true,
      initial: 'inactive',
      states: {
        inactive: {
          on: { ACTIVATE: 'active' }
        },
        active: {
          invoke: {
            src: () => {
              const localId = ++invokeCounter;

              actual.push(`start ${localId}`);

              return () => {
                return () => {
                  actual.push(`stop ${localId}`);
                };
              };
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

  // TODO: this might be tricky in v5 because this currently relies on `.exec` property being mutated to capture the context values in a closure
  it('initial actions should receive context updated only by preceeding assign actions', () => {
    const actual: number[] = [];

    const machine = createMachine({
      predictableActionArguments: true,
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

  it('`.nextState()` should not execute actions `predictableActionArguments`', () => {
    let spy = jest.fn();

    const machine = createMachine({
      predictableActionArguments: true,
      on: {
        TICK: {
          actions: spy
        }
      }
    });

    const service = interpret(machine).start();
    service.nextState({ type: 'TICK' });

    expect(spy).not.toBeCalled();
  });

  it('should create invoke based on context updated by entry actions of the same state', () => {
    const machine = createMachine({
      predictableActionArguments: true,
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
              return Promise.resolve();
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
      predictableActionArguments: true,
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
            src: () => (_sendBack, onReceive) => {
              onReceive((event) => {
                received = event;
              });
              return () => {};
            }
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
      predictableActionArguments: true,
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
      predictableActionArguments: true,
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
                cond: () =>
                  service.state.children.myChild.getSnapshot().value === 'b',
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
        expect(service.state.value).toBe('success');
        done();
      })
      .start();
  });

  it('should be possible to send immediate events to initially invoked actors', () => {
    const child = createMachine({
      predictableActionArguments: true,
      on: {
        PING: {
          actions: sendParent({ type: 'PONG' })
        }
      }
    });

    const machine = createMachine({
      predictableActionArguments: true,
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

  it('should execute actions when sending batched events', () => {
    let executed = false;

    const machine = createMachine({
      predictableActionArguments: true,
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          entry: () => (executed = true)
        }
      }
    });

    const service = interpret(machine).start();

    service.send([{ type: 'NEXT' }]);

    expect(executed).toBe(true);
  });

  it('should deliver events sent to other actors when using batched events', () => {
    let gotEvent = false;

    const machine = createMachine({
      predictableActionArguments: true,
      invoke: {
        id: 'myChild',
        src: () => (_sendBack, onReceive) => {
          onReceive(() => {
            gotEvent = true;
          });
        }
      },
      on: {
        PING_CHILD: {
          actions: send({ type: 'PING' }, { to: 'myChild' })
        }
      }
    });

    const service = interpret(machine).start();

    service.send([{ type: 'PING_CHILD' }]);

    expect(gotEvent).toBe(true);
  });

  // https://github.com/statelyai/xstate/issues/3617
  it('should deliver events sent from the exit actions to a service invoked in the same state', (done) => {
    const machine = createMachine({
      initial: 'active',
      predictableActionArguments: true,
      states: {
        active: {
          invoke: {
            id: 'my-service',
            src: (_, __) => (_, onReceive) => {
              onReceive((event) => {
                if (event.type === 'MY_EVENT') {
                  done();
                }
              });
            }
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
