import {
  Machine,
  interpret,
  assign,
  AnyEventObject,
  createMachine,
  sendParent
} from '../src';

const finalMachine = Machine({
  id: 'final',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: { on: { TIMER: 'red' } },
    red: {
      type: 'parallel',
      states: {
        crosswalk1: {
          initial: 'walk',
          states: {
            walk: {
              on: { PED_WAIT: 'wait' }
            },
            wait: {
              on: { PED_STOP: 'stop' }
            },
            stop: {
              type: 'final',
              data: { signal: 'stop' }
            }
          },
          onDone: {
            cond: (_, e) => e.data.signal === 'stop',
            actions: 'stopCrosswalk1'
          }
        },
        crosswalk2: {
          initial: 'walk',
          states: {
            walk: {
              on: { PED_WAIT: 'wait' }
            },
            wait: {
              on: { PED_STOP: 'stop' }
            },
            stop: {
              on: { PED_STOP: 'stop2' }
            },
            stop2: {
              type: 'final'
            }
          },
          onDone: {
            actions: 'stopCrosswalk2'
          }
        }
      },
      onDone: {
        target: 'green',
        actions: 'prepareGreenLight'
      }
    }
  },
  onDone: {
    // this action should never occur because final states are not direct children of machine
    actions: 'shouldNeverOccur'
  }
});

describe('final states', () => {
  it('should emit the "done.state.final.red" event when all nested states are in their final states', () => {
    const redState = finalMachine.transition('yellow', 'TIMER');
    expect(redState.value).toEqual({
      red: {
        crosswalk1: 'walk',
        crosswalk2: 'walk'
      }
    });
    const waitState = finalMachine.transition(redState, 'PED_WAIT');
    expect(waitState.value).toEqual({
      red: {
        crosswalk1: 'wait',
        crosswalk2: 'wait'
      }
    });
    const stopState = finalMachine.transition(waitState, 'PED_STOP');
    expect(stopState.value).toEqual({
      red: {
        crosswalk1: 'stop',
        crosswalk2: 'stop'
      }
    });

    expect(stopState.actions).toEqual([
      { type: 'stopCrosswalk1', exec: undefined }
    ]);

    const stopState2 = finalMachine.transition(stopState, 'PED_STOP');

    expect(stopState2.actions).toEqual([
      { type: 'stopCrosswalk2', exec: undefined },
      { type: 'prepareGreenLight', exec: undefined }
    ]);

    const greenState = finalMachine.transition(stopState, 'TIMER');
    expect(greenState.actions).toHaveLength(0);
  });

  it('should execute final child state actions first', () => {
    const nestedFinalMachine = Machine({
      id: 'nestedFinal',
      initial: 'foo',
      states: {
        foo: {
          initial: 'bar',
          onDone: { actions: 'fooAction' },
          states: {
            bar: {
              initial: 'baz',
              onDone: 'barFinal',
              states: {
                baz: {
                  type: 'final',
                  onEntry: 'bazAction'
                }
              }
            },
            barFinal: {
              type: 'final',
              onDone: { actions: 'barAction' }
            }
          }
        }
      }
    });

    const { initialState } = nestedFinalMachine;

    expect(initialState.actions.map((a) => a.type)).toEqual([
      'bazAction',
      'barAction',
      'fooAction'
    ]);
  });

  it('should call data expressions on nested final nodes', (done) => {
    interface Ctx {
      revealedSecret?: string;
    }

    const machine = Machine<Ctx>({
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
              data: {
                secret: () => 'the secret'
              }
            }
          },
          onDone: {
            target: 'success',
            actions: assign<Ctx, AnyEventObject>({
              revealedSecret: (_, event) => {
                return event.data.secret;
              }
            })
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    let _context: any;

    const service = interpret(machine)
      .onTransition((state) => (_context = state.context))
      .onDone(() => {
        expect(_context).toEqual({ revealedSecret: 'the secret' });
        done();
      })
      .start();

    service.send('REQUEST_SECRET');
  });

  it("should only call data expression once when entering root's final state", () => {
    const spy = jest.fn();
    const machine = Machine({
      initial: 'start',
      states: {
        start: {
          on: {
            FINISH: 'end'
          }
        },
        end: {
          type: 'final',
          data: spy
        }
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'FINISH', value: 1 });
    expect(spy).toBeCalledTimes(1);
  });

  it('should only call exit actions once when a child machine reaches its final state and sends an event to its parent that ends up stopping that child', () => {
    const spy = jest.fn();

    const child = createMachine({
      predictableActionArguments: true,
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
          entry: sendParent({ type: 'canceled' })
        }
      }
    });
    const parent = createMachine({
      predictableActionArguments: true,
      initial: 'start',
      states: {
        start: {
          invoke: {
            id: 'child',
            src: child,
            onDone: 'completed',
            onError: 'canceled'
          },
          on: {
            canceled: 'canceled'
          }
        },
        canceled: {
          type: 'final'
        },
        completed: {
          type: 'final'
        }
      }
    });

    const actorRef = interpret(parent).start();

    actorRef.children.get('child')!.send({
      type: 'CANCEL'
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
