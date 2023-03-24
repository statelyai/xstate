import {
  createMachine,
  interpret,
  assign,
  AnyEventObject
} from '../src/index.js';

const finalMachine = createMachine({
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
            guard: (_, e) => e.data.signal === 'stop',
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
    const redState = finalMachine.transition('yellow', { type: 'TIMER' });
    expect(redState.value).toEqual({
      red: {
        crosswalk1: 'walk',
        crosswalk2: 'walk'
      }
    });
    const waitState = finalMachine.transition(redState, { type: 'PED_WAIT' });
    expect(waitState.value).toEqual({
      red: {
        crosswalk1: 'wait',
        crosswalk2: 'wait'
      }
    });
    const stopState = finalMachine.transition(waitState, { type: 'PED_STOP' });
    expect(stopState.value).toEqual({
      red: {
        crosswalk1: 'stop',
        crosswalk2: 'stop'
      }
    });

    expect(stopState.actions).toEqual([
      expect.objectContaining({ type: 'stopCrosswalk1' })
    ]);

    const stopState2 = finalMachine.transition(stopState, { type: 'PED_STOP' });

    expect(stopState2.actions).toEqual([
      expect.objectContaining({ type: 'stopCrosswalk2' }),
      expect.objectContaining({ type: 'prepareGreenLight' })
    ]);

    const greenState = finalMachine.transition(stopState, { type: 'TIMER' });
    expect(greenState.actions).toHaveLength(0);
  });

  it('should execute final child state actions first', () => {
    const nestedFinalMachine = createMachine({
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
                  entry: 'bazAction'
                }
              }
            },
            barFinal: {
              type: 'final',
              entry: 'barAction'
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

    const machine = createMachine<Ctx>({
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

    const service = interpret(machine)
      .onDone(() => {
        expect(service.getSnapshot().context).toEqual({
          revealedSecret: 'the secret'
        });
        done();
      })
      .start();

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
          type: 'final',
          data: spy
        }
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'FINISH', value: 1 });
    expect(spy).toBeCalledTimes(1);
  });
});
