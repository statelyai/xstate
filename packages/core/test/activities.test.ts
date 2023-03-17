import { fromCallback } from '../src/actors/index.js';
import { interpret, createMachine, assign } from '../src/index.js';

// TODO: remove this file but before doing that ensure that things tested here are covered by other tests

describe('invocations (activities)', () => {
  it('identifies initial root invocations', () => {
    let active = false;
    const machine = createMachine({
      invoke: {
        src: fromCallback(() => {
          active = true;
        })
      }
    });
    interpret(machine).start();

    expect(active).toBe(true);
  });

  it('identifies initial invocations', () => {
    let active = false;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: fromCallback(() => {
              active = true;
            })
          }
        }
      }
    });
    interpret(machine).start();

    expect(active).toBe(true);
  });

  it('identifies initial deep invocations', () => {
    let active = false;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {
              invoke: {
                src: fromCallback(() => {
                  active = true;
                })
              }
            }
          }
        }
      }
    });
    interpret(machine).start();

    expect(active).toBe(true);
  });

  it('identifies start invocations', () => {
    let active = false;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            TIMER: 'b'
          }
        },
        b: {
          invoke: {
            src: fromCallback(() => {
              active = true;
            })
          }
        }
      }
    });

    const service = interpret(machine).start();

    service.send({ type: 'TIMER' });

    expect(active).toBe(true);
  });

  it('identifies start invocations for child states and active invocations', () => {
    let active = false;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            TIMER: 'b'
          }
        },
        b: {
          initial: 'b1',
          states: {
            b1: {
              on: {
                TIMER: 'b2'
              }
            },
            b2: {
              invoke: {
                src: fromCallback(() => {
                  active = true;
                })
              }
            }
          }
        }
      }
    });
    const service = interpret(machine);

    service.start();
    service.send({ type: 'TIMER' });
    service.send({ type: 'TIMER' });

    expect(active).toBe(true);
  });

  it('identifies stop invocations for child states', () => {
    let active = false;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            TIMER: 'b'
          }
        },
        b: {
          initial: 'b1',
          states: {
            b1: {
              on: {
                TIMER: 'b2'
              }
            },
            b2: {
              invoke: {
                src: fromCallback(() => {
                  active = true;
                  return () => (active = false);
                })
              },
              on: {
                TIMER: 'b3'
              }
            },
            b3: {}
          }
        }
      }
    });
    const service = interpret(machine).start();

    service.send({ type: 'TIMER' });
    service.send({ type: 'TIMER' });
    service.send({ type: 'TIMER' });

    expect(active).toBe(false);
  });

  it('identifies multiple stop invocations for child and parent states', () => {
    let active1 = false;
    let active2 = false;

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            TIMER: 'b'
          }
        },
        b: {
          initial: 'b1',
          invoke: {
            src: fromCallback(() => {
              active1 = true;
              return () => (active1 = false);
            })
          },
          states: {
            b1: {
              invoke: {
                src: fromCallback(() => {
                  active2 = true;
                  return () => (active2 = false);
                })
              }
            }
          },
          on: {
            TIMER: 'a'
          }
        }
      }
    });
    const service = interpret(machine);

    service.start();
    service.send({ type: 'TIMER' });
    service.send({ type: 'TIMER' });

    expect(active1).toBe(false);
    expect(active2).toBe(false);
  });

  it('should activate even if there are subsequent always but blocked transition', () => {
    let active = false;
    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          on: {
            E: 'B'
          }
        },
        B: {
          invoke: {
            src: fromCallback(() => {
              active = true;
              return () => (active = false);
            })
          },
          always: [{ guard: () => false, target: 'A' }]
        }
      }
    });

    const service = interpret(machine).start();

    service.send({ type: 'E' });

    expect(active).toBe(true);
  });

  it('should remember the invocations even after an ignored event', () => {
    let cleanupSpy = jest.fn();
    let active = false;
    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          on: {
            E: 'B'
          }
        },
        B: {
          invoke: {
            src: fromCallback(() => {
              active = true;
              return () => {
                active = false;
                cleanupSpy();
              };
            })
          }
        }
      }
    });
    const service = interpret(machine).start();

    service.send({ type: 'E' });
    service.send({ type: 'IGNORE' });

    expect(active).toBe(true);
    expect(cleanupSpy).not.toBeCalled();
  });

  it('should remember the invocations when transitioning within the invoking state', () => {
    let cleanupSpy = jest.fn();
    let active = false;
    const machine = createMachine({
      initial: 'A',
      states: {
        A: {
          invoke: {
            src: fromCallback(() => {
              active = true;
              return () => {
                active = false;
                cleanupSpy();
              };
            })
          },
          initial: 'A1',
          states: {
            A1: {
              on: {
                E: 'A2'
              }
            },
            A2: {}
          }
        }
      }
    });
    const service = interpret(machine).start();

    service.send({ type: 'E' });

    expect(active).toBe(true);
    expect(cleanupSpy).not.toBeCalled();
  });

  it('should start a new actor when leaving an invoking state and entering a new one that invokes the same actor type', () => {
    let counter = 0;
    const actual: string[] = [];
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: 'fooActor'
            },
            on: {
              NEXT: 'b'
            }
          },
          b: {
            invoke: {
              src: 'fooActor'
            }
          }
        }
      },
      {
        actors: {
          fooActor: fromCallback(() => {
            let localId = counter;
            counter++;

            actual.push(`start ${localId}`);

            return () => {
              actual.push(`stop ${localId}`);
            };
          })
        }
      }
    );
    const service = interpret(machine).start();

    service.send({ type: 'NEXT' });

    expect(actual).toEqual(['start 0', 'stop 0', 'start 1']);
  });

  it('should start a new actor when reentering the invoking state during an external self transition', () => {
    let counter = 0;
    const actual: string[] = [];
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: 'fooActor'
            },
            on: {
              NEXT: {
                target: 'a',
                external: true
              }
            }
          }
        }
      },
      {
        actors: {
          fooActor: fromCallback(() => {
            let localId = counter;
            counter++;

            actual.push(`start ${localId}`);

            return () => {
              actual.push(`stop ${localId}`);
            };
          })
        }
      }
    );
    const service = interpret(machine).start();

    service.send({ type: 'NEXT' });

    expect(actual).toEqual(['start 0', 'stop 0', 'start 1']);
  });

  it('should have stopped after automatic transitions', () => {
    let active = false;
    const machine = createMachine({
      context: {
        counter: 0
      },
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: fromCallback(() => {
              active = true;
              return () => (active = false);
            })
          },
          always: {
            guard: (ctx) => ctx.counter !== 0,
            target: 'b'
          },
          on: {
            INC: {
              actions: assign((ctx) => ({
                counter: ctx.counter + 1
              }))
            }
          }
        },
        b: {}
      }
    });
    const service = interpret(machine).start();

    expect(active).toBe(true);

    service.send({ type: 'INC' });

    expect(active).toBe(false);
  });
});
