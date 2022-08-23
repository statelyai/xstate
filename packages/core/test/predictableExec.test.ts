import { createMachine, interpret, assign, spawn } from '../src';
import { raise, stop, send } from '../src/actions';

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
});
