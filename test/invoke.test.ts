import {
  Machine,
  interpret,
  assign,
  sendParent,
  send,
  EventObject
} from '../src/index';
import { assert } from 'chai';
import { actionTypes, done as _done } from '../src/actions';

const user = { name: 'David' };

const fetchMachine = Machine<{ userId: string | undefined }>({
  id: 'fetch',
  context: {
    userId: undefined
  },
  initial: 'pending',
  states: {
    pending: {
      onEntry: send({ type: 'RESOLVE', user }),
      on: {
        RESOLVE: {
          target: 'success',
          cond: ctx => ctx.userId !== undefined
        }
      }
    },
    success: {
      type: 'final',
      data: { user: (_, e) => e.user }
    },
    failure: {
      onEntry: sendParent('REJECT')
    }
  }
});

const fetcherMachine = Machine({
  id: 'fetcher',
  initial: 'idle',
  context: {
    selectedUserId: '42',
    user: undefined
  },
  states: {
    idle: {
      on: {
        GO_TO_WAITING: 'waiting',
        GO_TO_WAITING_MACHINE: 'waitingInvokeMachine'
      }
    },
    waiting: {
      invoke: {
        src: fetchMachine,
        data: {
          userId: ctx => ctx.selectedUserId
        },
        onDone: {
          target: 'received',
          cond: (_, e) => {
            // Should receive { user: { name: 'David' } } as event data
            return e.data.user.name === 'David';
          }
        }
      }
    },
    waitingInvokeMachine: {
      invoke: {
        src: fetchMachine.withContext({ userId: '55' }),
        onDone: 'received'
      }
    },
    received: {
      type: 'final'
    }
  }
});

// @ts-ignore
const intervalMachine = Machine({
  id: 'interval',
  initial: 'counting',
  context: {
    interval: 10,
    count: 0
  },
  states: {
    counting: {
      invoke: {
        id: 'intervalService',
        src: ctx => cb => {
          const interval = setInterval(() => {
            cb('INC');
          }, ctx.interval);

          return () => clearInterval(interval);
        }
      },
      on: {
        '': {
          target: 'finished',
          cond: ctx => ctx.count === 3
        },
        INC: { actions: assign({ count: ctx => ctx.count + 1 }) },
        SKIP: 'wait'
      }
    },
    wait: {
      on: {
        // this should never be called if interval service is properly disposed
        INC: { actions: assign({ count: ctx => ctx.count + 1 }) }
      },
      after: {
        50: 'finished'
      }
    },
    finished: {
      type: 'final'
    }
  }
});

describe('invoke', () => {
  it('should start services (external machines)', done => {
    const childMachine = Machine({
      id: 'child',
      initial: 'init',
      states: {
        init: {
          onEntry: [sendParent('INC'), sendParent('INC')]
        }
      }
    });

    const someParentMachine = Machine(
      {
        id: 'parent',
        context: { count: 0 },
        initial: 'start',
        states: {
          start: {
            invoke: {
              src: 'child',
              id: 'someService',
              forward: true
            },
            on: {
              INC: { actions: assign({ count: ctx => ctx.count + 1 }) },
              '': {
                target: 'stop',
                cond: ctx => ctx.count === 2
              }
            }
          },
          stop: {
            type: 'final'
          }
        }
      },
      {
        services: {
          child: childMachine
        }
      }
    );

    const service = interpret(someParentMachine)
      .onDone(() => {
        // 1. The 'parent' machine will enter 'start' state
        // 2. The 'child' service will be run with ID 'someService'
        // 3. The 'child' machine will enter 'init' state
        // 4. The 'onEntry' action will be executed, which sends 'INC' to 'parent' machine twice
        // 5. The context will be updated to increment count to 2

        assert.deepEqual(service.state.context, { count: 2 });
        done();
      })
      .start();
  });

  it('should forward events to services if forward: true', () => {
    const childMachine = Machine({
      id: 'child',
      initial: 'init',
      states: {
        init: {
          on: {
            FORWARD_DEC: {
              actions: [sendParent('DEC'), sendParent('DEC'), sendParent('DEC')]
            }
          }
        }
      }
    });

    const someParentMachine = Machine(
      {
        id: 'parent',
        context: { count: 0 },
        initial: 'start',
        states: {
          start: {
            invoke: {
              src: 'child',
              id: 'someService',
              forward: true
            },
            on: {
              DEC: { actions: assign({ count: ctx => ctx.count - 1 }) },
              FORWARD_DEC: undefined,
              '': {
                target: 'stop',
                cond: ctx => ctx.count === -3
              }
            }
          },
          stop: {
            type: 'final'
          }
        }
      },
      {
        services: {
          child: childMachine
        }
      }
    );

    const service = interpret(someParentMachine)
      .onDone(() => {
        // 1. The 'parent' machine will not do anything (inert transition)
        // 2. The 'FORWARD_DEC' event will be forwarded to the 'child' machine (forward: true)
        // 3. On the 'child' machine, the 'FORWARD_DEC' event sends the 'DEC' action to the 'parent' thrice
        // 4. The context of the 'parent' machine will be updated from 2 to -1

        assert.deepEqual(service.state.context, { count: -3 });
      })
      .start();

    service.send('FORWARD_DEC');
  });

  it('should start services (explicit machine, invoke = config)', done => {
    interpret(fetcherMachine)
      .onDone(() => {
        done();
      })
      .start()
      .send('GO_TO_WAITING');
  });

  it('should start services (explicit machine, invoke = machine)', done => {
    interpret(fetcherMachine)
      .onDone(_ => {
        done();
      })
      .start()
      .send('GO_TO_WAITING_MACHINE');
  });

  it('should use the service overwritten by withConfig', done => {
    const childMachine = Machine({
      id: 'child',
      initial: 'init',
      states: {
        init: {}
      }
    });

    const someParentMachine = Machine(
      {
        id: 'parent',
        context: { count: 0 },
        initial: 'start',
        states: {
          start: {
            invoke: {
              src: 'child',
              id: 'someService',
              forward: true
            },
            on: {
              STOP: 'stop'
            }
          },
          stop: {
            type: 'final'
          }
        }
      },
      {
        services: {
          child: childMachine
        }
      }
    );

    interpret(
      someParentMachine.withConfig({
        services: {
          child: Machine({
            id: 'child',
            initial: 'init',
            states: {
              init: {
                onEntry: [sendParent('STOP')]
              }
            }
          })
        }
      })
    )
      .onDone(() => {
        done();
      })
      .start();
  });

  describe('parent to child', () => {
    const subMachine = Machine({
      id: 'child',
      initial: 'one',
      states: {
        one: {
          on: { NEXT: 'two' }
        },
        two: {
          onEntry: sendParent('NEXT')
        }
      }
    });

    // console.dir(mainMachine.activities, { depth: null });

    it('should communicate with the child machine (invoke on machine)', done => {
      const mainMachine = Machine({
        id: 'parent',
        initial: 'one',
        invoke: {
          id: 'foo-child',
          src: subMachine
        },
        states: {
          one: {
            onEntry: send('NEXT', { to: 'foo-child' }),
            on: { NEXT: 'two' }
          },
          two: {
            type: 'final'
          }
        }
      });

      interpret(mainMachine)
        .onDone(() => {
          done();
        })
        .start();
    });

    it('should communicate with the child machine (invoke on created machine)', done => {
      interface MainMachineCtx {
        machine: typeof subMachine;
      }

      const mainMachine = Machine<MainMachineCtx>({
        id: 'parent',
        initial: 'one',
        context: {
          machine: subMachine
        },
        invoke: {
          id: 'foo-child',
          src: ctx => ctx.machine
        },
        states: {
          one: {
            onEntry: send('NEXT', { to: 'foo-child' }),
            on: { NEXT: 'two' }
          },
          two: {
            type: 'final'
          }
        }
      });

      interpret(mainMachine)
        .onDone(() => {
          done();
        })
        .start();
    });

    it('should communicate with the child machine (invoke on state)', done => {
      const mainMachine = Machine({
        id: 'parent',
        initial: 'one',
        states: {
          one: {
            invoke: {
              id: 'foo-child',
              src: subMachine
            },
            onEntry: send('NEXT', { to: 'foo-child' }),
            on: { NEXT: 'two' }
          },
          two: {
            type: 'final'
          }
        }
      });

      interpret(mainMachine)
        .onDone(() => {
          done();
        })
        .start();
    });
  });

  describe('with promises', () => {
    const invokePromiseMachine = Machine({
      id: 'invokePromise',
      initial: 'pending',
      context: {
        id: 42,
        succeed: true
      },
      states: {
        pending: {
          invoke: {
            src: ctx =>
              new Promise(resolve => {
                if (ctx.succeed) {
                  resolve(ctx.id);
                } else {
                  throw new Error(`failed on purpose for: ${ctx.id}`);
                }
              }),
            onDone: {
              target: 'success',
              cond: (ctx, e) => {
                return e.data === ctx.id;
              }
            },
            onError: 'failure'
          }
        },
        success: {
          type: 'final'
        },
        failure: {
          type: 'final'
        }
      }
    });

    it('should be invoked with a promise factory and resolve through onDone', done => {
      interpret(invokePromiseMachine)
        .onDone(() => done())
        .start();
    });

    it('should be invoked with a promise factory and reject with ErrorExecution', done => {
      interpret(invokePromiseMachine.withContext({ id: 31, succeed: false }))
        .onDone(() => done())
        .start();
    });

    it('should be able to specify a Promise as a service', done => {
      const promiseMachine = Machine(
        {
          id: 'promise',
          initial: 'pending',
          context: { foo: true },
          states: {
            pending: {
              on: { BEGIN: 'first' }
            },
            first: {
              invoke: {
                src: 'somePromise',
                onDone: 'last'
              }
            },
            last: {
              type: 'final'
            }
          }
        },
        {
          services: {
            somePromise: (ctx, e) => {
              return new Promise((res, rej) => {
                ctx.foo && e.payload ? res() : rej();
              });
            }
          }
        }
      );

      interpret(promiseMachine)
        .onDone(() => done())
        .start()
        .send({ type: 'BEGIN', payload: true });
    });

    it('should be able to specify a callback as a service', done => {
      const callbackMachine = Machine(
        {
          id: 'callback',
          initial: 'pending',
          context: { foo: true },
          states: {
            pending: {
              on: { BEGIN: 'first' }
            },
            first: {
              invoke: {
                src: 'someCallback'
              },
              on: {
                CALLBACK: {
                  target: 'last',
                  cond: (_, e) => e.data === 42
                }
              }
            },
            last: {
              type: 'final'
            }
          }
        },
        {
          services: {
            someCallback: (ctx, e) => cb => {
              if (ctx.foo && e.payload) {
                cb({ type: 'CALLBACK', data: 40 });
                cb({ type: 'CALLBACK', data: 41 });
                cb({ type: 'CALLBACK', data: 42 });
              }
            }
          }
        }
      );

      interpret(callbackMachine)
        .onDone(() => done())
        .start()
        .send({ type: 'BEGIN', payload: true });
    });
  });

  describe('with callbacks', () => {
    it('should treat a callback source as an event stream', done => {
      interpret(intervalMachine)
        .onDone(() => done())
        .start();
    });

    it('should dispose of the callback (if disposal function provided)', done => {
      const service = interpret(intervalMachine)
        .onDone(() => {
          // if intervalService isn't disposed after skipping, 'INC' event will
          // keep being sent
          assert.equal(
            service.state.context.count,
            0,
            'should exit interval service before the first event is sent'
          );
          done();
        })
        .start();

      // waits 50 milliseconds before going to final state.
      service.send('SKIP');
    });

    it('callback should be able to receive messages from parent', done => {
      const pingPongMachine = Machine({
        id: 'ping-pong',
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'child',
              src: () => (next, onEvent) => {
                onEvent(e => {
                  if (e.type === 'PING') {
                    next('PONG');
                  }
                });
              }
            },
            onEntry: send('PING', { to: 'child' }),
            on: {
              PONG: 'done'
            }
          },
          done: {
            type: 'final'
          }
        }
      });

      interpret(pingPongMachine)
        .onDone(() => done())
        .start();
    });

    it('should call onError upon error (sync)', done => {
      const errorMachine = Machine({
        id: 'error',
        initial: 'safe',
        states: {
          safe: {
            invoke: {
              src: () => () => {
                throw new Error('test');
              },
              onError: {
                target: 'failed',
                cond: (_, e) => {
                  return e.data instanceof Error && e.data.message === 'test';
                }
              }
            }
          },
          failed: {
            type: 'final'
          }
        }
      });

      interpret(errorMachine)
        .onDone(() => done())
        .start();
    });

    it('should call onError upon error (async)', done => {
      const errorMachine = Machine({
        id: 'asyncError',
        initial: 'safe',
        states: {
          safe: {
            invoke: {
              src: () => async () => {
                await true;
                throw new Error('test');
              },
              onError: {
                target: 'failed',
                cond: (_, e) => {
                  return e.data instanceof Error && e.data.message === 'test';
                }
              }
            }
          },
          failed: {
            type: 'final'
          }
        }
      });

      interpret(errorMachine)
        .onDone(() => done())
        .start();
    });

    it('should be able to be stringified', () => {
      const waitingState = fetcherMachine.transition(
        fetcherMachine.initialState,
        'GO_TO_WAITING'
      );

      assert.doesNotThrow(() => {
        JSON.stringify(waitingState);
      });

      assert.isString(waitingState.actions[0].activity!.src);
    });

    xit('should throw error if unhandled (sync)', done => {
      const errorMachine = Machine({
        id: 'asyncError',
        initial: 'safe',
        states: {
          safe: {
            invoke: {
              src: () => () => {
                throw new Error('test');
              }
            }
          },
          failed: {
            type: 'final'
          }
        }
      });

      interpret(errorMachine)
        .onDone(() => done())
        .start();
    });

    xit('should throw error if unhandled (async)', done => {
      const errorMachine = Machine({
        id: 'asyncError',
        initial: 'safe',
        states: {
          safe: {
            invoke: {
              src: () => async () => {
                await true;
                throw new Error('test');
              }
            }
          },
          failed: {
            type: 'final'
          }
        }
      });

      interpret(errorMachine)
        .onDone(() => done())
        .start();
    });

    describe('sub invoke race condition', () => {
      const anotherChildMachine = Machine({
        id: 'child',
        initial: 'start',
        states: {
          start: {
            on: { STOP: 'end' }
          },
          end: {
            type: 'final'
          }
        }
      });

      const anotherParentMachine = Machine({
        id: 'parent',
        initial: 'begin',
        states: {
          begin: {
            invoke: {
              src: anotherChildMachine,
              id: 'invoked.child',
              onDone: 'completed'
            },
            on: {
              STOPCHILD: {
                actions: send('STOP', { to: 'invoked.child' })
              }
            }
          },
          completed: {
            type: 'final'
          }
        }
      });

      it('ends on the completed state', done => {
        const events: EventObject[] = [];
        const service = interpret(anotherParentMachine)
          .onEvent(e => {
            events.push(e);
          })
          .onDone(() => {
            assert.deepEqual(events.map(e => e.type), [
              actionTypes.init,
              'STOPCHILD',
              _done('parent').type
            ]);
            assert.equal(service.state.value, 'completed');
            done();
          })
          .start();

        service.send('STOPCHILD');
      });
    });
  });
});
