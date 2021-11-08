import { createMachine } from '../src/Machine';
import { toPromise, validatePromiseMachine } from '../src/toPromise';

describe('toPromise', () => {
  describe('validatePromiseMachine', () => {
    it('Should not allow states without invocations or final', () => {
      const errors = validatePromiseMachine(
        createMachine({
          id: 'machine',
          initial: 'pending',
          states: {
            pending: {}
          }
        })
      );

      expect(errors).toEqual([
        {
          stateId: 'machine.pending',
          type: 'state-not-final-nor-invocation'
        }
      ]);
    });

    it('Should ensure that invocations have a valid onError transition', () => {
      const errors = validatePromiseMachine(
        createMachine({
          id: 'machine',
          initial: 'pending',
          after: {
            800: 'done'
          },
          states: {
            pending: {
              invoke: {
                src: 'fetch'
              }
            },
            done: {
              type: 'final'
            }
          }
        })
      );

      expect(errors).toEqual([
        {
          stateId: 'machine.pending',
          type: 'no-error-transition-on-invoke-state',
          invocationId: 'fetch'
        }
      ]);
    });

    it('Should ensure that invocations have an onError transition without a cond', () => {
      const errors = validatePromiseMachine(
        createMachine({
          id: 'machine',
          initial: 'pending',
          after: {
            800: 'done'
          },
          states: {
            pending: {
              invoke: {
                src: 'fetch',
                onError: {
                  cond: 'someCondition',
                  target: 'done'
                }
              }
            },
            done: {
              type: 'final'
            }
          }
        })
      );

      expect(errors).toEqual([
        {
          stateId: 'machine.pending',
          type: 'no-error-transition-without-cond-on-invoke-state',
          invocationId: 'fetch'
        }
      ]);
    });

    it('Should ensure that invocations have an onError transition that targets something', () => {
      const errors = validatePromiseMachine(
        createMachine({
          id: 'machine',
          initial: 'pending',
          after: {
            800: 'done'
          },
          states: {
            pending: {
              invoke: {
                src: 'fetch',
                onError: {
                  target: 'pending'
                }
              }
            },
            done: {
              type: 'final'
            }
          }
        })
      );

      expect(errors).toEqual([
        {
          stateId: 'machine.pending',
          invocationId: 'fetch',
          type: 'error-transition-targets-self'
        }
      ]);
    });

    it('Should ensure that all invocation states have a timeout', () => {
      const errors = validatePromiseMachine(
        createMachine({
          id: 'machine',
          initial: 'pending',
          states: {
            pending: {
              invoke: {
                src: 'fetch',
                onError: {
                  target: 'done'
                }
              }
            },
            done: {
              type: 'final'
            }
          }
        })
      );

      expect(errors).toEqual([
        {
          stateId: 'machine.pending',
          type: 'no-timeout'
        }
      ]);
    });

    it('Should allow you to put the timeout in the parent', () => {
      const errors = validatePromiseMachine(
        createMachine({
          id: 'machine',
          initial: 'pending',
          after: {
            800: 'done'
          },
          states: {
            pending: {
              invoke: {
                src: 'fetch',
                onError: {
                  target: 'done'
                }
              }
            },
            done: {
              type: 'final'
            }
          }
        })
      );

      expect(errors).toEqual([]);
    });

    it('Should not allow you to self-target from the timeout', () => {
      const errors = validatePromiseMachine(
        createMachine({
          id: 'machine',
          initial: 'pending',

          states: {
            pending: {
              invoke: {
                src: 'fetch',
                onError: {
                  target: 'done'
                }
              },
              after: {
                800: 'pending'
              }
            },
            done: {
              type: 'final'
            }
          }
        })
      );

      expect(errors).toEqual([
        {
          stateId: 'machine.pending',
          type: 'timeout-targets-self'
        }
      ]);
    });

    it('Should require a timeout without a cond', () => {
      const errors = validatePromiseMachine(
        createMachine({
          id: 'machine',
          initial: 'pending',

          states: {
            pending: {
              after: {
                800: { target: 'done', cond: 'someCond' }
              },
              invoke: {
                src: 'fetch',
                onError: {
                  target: 'done'
                }
              }
            },
            done: {
              type: 'final'
            }
          }
        })
      );

      expect(errors).toEqual([
        {
          stateId: 'machine.pending',
          type: 'no-timeout-without-cond'
        }
      ]);
    });
  });

  describe('toPromise', () => {
    it('Should invoke the machine and run services', async () => {
      const mockFunc = jest.fn();
      const state = await toPromise(
        createMachine({
          initial: 'idle',
          after: {
            10000: {
              target: 'timedOut'
            }
          },
          states: {
            idle: {
              invoke: {
                src: async () => {
                  return mockFunc();
                },
                onDone: {
                  target: 'final'
                },
                onError: {
                  target: 'errored'
                }
              }
            },
            timedOut: {
              type: 'final'
            },
            errored: {
              type: 'final'
            },
            final: {
              type: 'final'
            }
          }
        })
      );

      expect(state.value).toEqual('final');
      expect(mockFunc).toHaveBeenCalled();
    });
  });
});
