import { createActor, createMachine, fromCallback } from '../src/index';

describe('history states', () => {
  it('should go to the most recently visited state (explicit shallow history type)', () => {
    const machine = createMachine({
      initial: 'on',
      states: {
        on: {
          initial: 'first',
          states: {
            first: {
              on: { SWITCH: 'second' }
            },
            second: {},
            hist: {
              type: 'history',
              history: 'shallow'
            }
          },
          on: {
            POWER: 'off'
          }
        },
        off: {
          on: { POWER: 'on.hist' }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'POWER' });

    expect(actorRef.getSnapshot().value).toEqual({ on: 'second' });
  });

  it('should go to the most recently visited state (no explicit history type)', () => {
    const machine = createMachine({
      initial: 'on',
      states: {
        on: {
          initial: 'first',
          states: {
            first: {
              on: { SWITCH: 'second' }
            },
            second: {},
            hist: {
              type: 'history'
            }
          },
          on: {
            POWER: 'off'
          }
        },
        off: {
          on: { POWER: 'on.hist' }
        }
      }
    });
    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'POWER' });

    expect(actorRef.getSnapshot().value).toEqual({ on: 'second' });
  });

  it('should go to the initial state when no history present (explicit shallow history type)', () => {
    const machine = createMachine({
      initial: 'off',
      states: {
        off: {
          on: { POWER: 'on.hist' }
        },
        on: {
          initial: 'first',
          states: {
            first: {},
            second: {},
            hist: {
              type: 'history',
              history: 'shallow'
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'POWER' });

    expect(actorRef.getSnapshot().value).toEqual({ on: 'first' });
  });

  it('should go to the initial state when no history present (no explicit history type)', () => {
    const machine = createMachine({
      initial: 'off',
      states: {
        off: {
          on: { POWER: 'on.hist' }
        },
        on: {
          initial: 'first',
          states: {
            first: {},
            second: {},
            hist: {
              type: 'history'
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'POWER' });

    expect(actorRef.getSnapshot().value).toEqual({ on: 'first' });
  });

  it('should go to the most recently visited state by a transient transition', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          id: 'idle',
          initial: 'absent',
          states: {
            absent: {
              on: {
                DEPLOY: '#deploy'
              }
            },
            present: {
              on: {
                DEPLOY: '#deploy',
                DESTROY: '#destroy'
              }
            },
            hist: {
              type: 'history'
            }
          }
        },
        deploy: {
          id: 'deploy',
          on: {
            SUCCESS: 'idle.present',
            FAILURE: 'idle.hist'
          }
        },
        destroy: {
          id: 'destroy',
          always: [{ target: 'idle.absent' }]
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'DEPLOY' });
    actorRef.send({ type: 'SUCCESS' });
    actorRef.send({ type: 'DESTROY' });
    actorRef.send({ type: 'DEPLOY' });
    actorRef.send({ type: 'FAILURE' });

    expect(actorRef.getSnapshot().value).toEqual({ idle: 'absent' });
  });

  it('should reenter persisted state during reentering transition targeting a history state', () => {
    const actual: string[] = [];

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            REENTER: {
              target: '#b_hist',
              reenter: true
            }
          },
          initial: 'a1',
          states: {
            a1: {
              on: {
                NEXT: 'a2'
              }
            },
            a2: {
              entry: () => actual.push('a2 entered'),
              exit: () => actual.push('a2 exited')
            },
            a3: {
              type: 'history',
              id: 'b_hist'
            }
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'NEXT' });

    actual.length = 0;
    actorRef.send({ type: 'REENTER' });

    expect(actual).toEqual(['a2 exited', 'a2 entered']);
  });

  it('should go to the configured default target when a history state is the initial state of the machine', () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          type: 'history',
          target: 'bar'
        },
        bar: {}
      }
    });

    const actorRef = createActor(machine).start();

    expect(actorRef.getSnapshot().value).toBe('bar');
  });

  it(`should go to the configured default target when a history state is the initial state of the transition's target`, () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            NEXT: 'bar'
          }
        },
        bar: {
          initial: 'baz',
          states: {
            baz: {
              type: 'history',
              target: 'qwe'
            },
            qwe: {}
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'NEXT' });

    expect(actorRef.getSnapshot().value).toEqual({
      bar: 'qwe'
    });
  });

  it('should execute actions of the initial transition when a history state without a default target is targeted and its parent state was never visited yet', () => {
    const spy = jest.fn();

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: '#hist' }
        },
        b: {
          initial: {
            target: 'b1',
            actions: spy
          },
          states: {
            b1: {},
            b2: {
              id: 'hist',
              type: 'history'
            }
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should not execute actions of the initial transition when a history state with a default target is targeted and its parent state was never visited yet', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: '#hist' }
        },
        b: {
          initial: {
            target: 'b1',
            actions: spy
          },
          states: {
            b1: {},
            b2: {
              id: 'hist',
              type: 'history',
              target: 'b3'
            },
            b3: {}
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });

    expect(spy).not.toHaveBeenCalled();
  });

  it('should execute entry actions of a parent of the targeted history state when its parent state was never visited yet', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: '#hist' }
        },
        b: {
          entry: spy,
          initial: 'b1',
          states: {
            b1: {},
            b2: {
              id: 'hist',
              type: 'history',
              target: 'b3'
            },
            b3: {}
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should execute actions of the initial transition when it select a history state as the initial state of its parent', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          initial: {
            target: 'b1',
            actions: spy
          },
          states: {
            b1: {
              id: 'hist',
              type: 'history',
              target: 'b2'
            },
            b2: {}
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should execute actions of the initial transition when a history state without a default target is targeted and its parent state was already visited', () => {
    const spy = jest.fn();

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: '#hist' }
        },
        b: {
          initial: {
            target: 'b1',
            actions: spy
          },
          states: {
            b1: {},
            b2: {
              id: 'hist',
              type: 'history'
            }
          },
          on: {
            NEXT: 'a'
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });
    spy.mockClear();

    actorRef.send({ type: 'NEXT' });
    actorRef.send({ type: 'NEXT' });

    expect(spy).toHaveBeenCalledTimes(0);
  });

  it('should not execute actions of the initial transition when a history state with a default target is targeted and its parent state was already visited', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: '#hist' }
        },
        b: {
          initial: {
            target: 'b1',
            actions: spy
          },
          states: {
            b1: {},
            b2: {
              id: 'hist',
              type: 'history',
              target: 'b3'
            },
            b3: {}
          },
          on: {
            NEXT: 'a'
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });
    spy.mockClear();

    actorRef.send({ type: 'NEXT' });
    actorRef.send({ type: 'NEXT' });

    expect(spy).not.toHaveBeenCalled();
  });

  it('should execute entry actions of a parent of the targeted history state when its parent state was already visited', () => {
    const spy = jest.fn();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: '#hist' }
        },
        b: {
          entry: spy,
          initial: 'b1',
          states: {
            b1: {},
            b2: {
              id: 'hist',
              type: 'history',
              target: 'b3'
            },
            b3: {}
          },
          on: {
            NEXT: 'a'
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'NEXT' });
    spy.mockClear();

    actorRef.send({ type: 'NEXT' });
    actorRef.send({ type: 'NEXT' });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should invoke an actor when reentering the stored configuration through the history state', () => {
    const spy = jest.fn();

    const machine = createMachine({
      initial: 'running',
      states: {
        running: {
          on: {
            PING: {
              target: 'refresh'
            }
          },
          invoke: {
            src: fromCallback(spy)
          }
        },
        refresh: {
          type: 'history'
        }
      }
    });
    const actorRef = createActor(machine).start();
    spy.mockClear();

    actorRef.send({ type: 'PING' });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('deep history states', () => {
  it('should go to the shallow history', () => {
    const machine = createMachine({
      initial: 'on',
      states: {
        off: {
          on: {
            POWER: 'on.history'
          }
        },
        on: {
          initial: 'first',
          states: {
            first: {
              on: { SWITCH: 'second' }
            },
            second: {
              initial: 'A',
              states: {
                A: {
                  on: { INNER: 'B' }
                },
                B: {
                  initial: 'P',
                  states: {
                    P: {},
                    Q: {}
                  }
                }
              }
            },
            history: { history: 'shallow' }
          },
          on: {
            POWER: 'off'
          }
        }
      }
    });
    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'INNER' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'POWER' });

    expect(actorRef.getSnapshot().value).toEqual({
      on: {
        second: 'A'
      }
    });
  });

  it('should go to the deep history (explicit)', () => {
    const machine = createMachine({
      initial: 'on',
      states: {
        off: {
          on: {
            POWER: 'on.history'
          }
        },
        on: {
          initial: 'first',
          states: {
            first: {
              on: { SWITCH: 'second' }
            },
            second: {
              initial: 'A',
              states: {
                A: {
                  on: { INNER: 'B' }
                },
                B: {
                  initial: 'P',
                  states: {
                    P: {},
                    Q: {}
                  }
                }
              }
            },
            history: { history: 'deep' }
          },
          on: {
            POWER: 'off'
          }
        }
      }
    });
    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'INNER' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'POWER' });

    expect(actorRef.getSnapshot().value).toEqual({
      on: {
        second: {
          B: 'P'
        }
      }
    });
  });

  it('should go to the deepest history', () => {
    const machine = createMachine({
      initial: 'on',
      states: {
        off: {
          on: {
            POWER: 'on.history'
          }
        },
        on: {
          initial: 'first',
          states: {
            first: {
              on: { SWITCH: 'second' }
            },
            second: {
              initial: 'A',
              states: {
                A: {
                  on: { INNER: 'B' }
                },
                B: {
                  initial: 'P',
                  states: {
                    P: {
                      on: { INNER: 'Q' }
                    },
                    Q: {}
                  }
                }
              }
            },
            history: { history: 'deep' }
          },
          on: {
            POWER: 'off'
          }
        }
      }
    });
    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'INNER' });
    actorRef.send({ type: 'INNER' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'POWER' });

    expect(actorRef.getSnapshot().value).toEqual({
      on: {
        second: {
          B: 'Q'
        }
      }
    });
  });
});

describe('parallel history states', () => {
  it('should ignore parallel state history', () => {
    const machine = createMachine({
      initial: 'off',
      states: {
        off: {
          on: {
            SWITCH: 'on',
            POWER: 'on.hist'
          }
        },
        on: {
          type: 'parallel',
          states: {
            A: {
              initial: 'B',
              states: {
                B: {
                  on: { INNER_A: 'C' }
                },
                C: {
                  initial: 'D',
                  states: {
                    D: {},
                    E: {}
                  }
                },
                hist: { history: true }
              }
            },
            K: {
              initial: 'L',
              states: {
                L: {},
                M: {},
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            hist: {
              history: true
            }
          },
          on: {
            POWER: 'off'
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'INNER_A' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'POWER' });

    expect(actorRef.getSnapshot().value).toEqual({
      on: {
        A: 'B',
        K: 'L'
      }
    });
  });

  it('should remember first level state history', () => {
    const machine = createMachine({
      initial: 'off',
      states: {
        off: {
          on: {
            SWITCH: 'on',
            DEEP_POWER: 'on.deepHistory'
          }
        },
        on: {
          type: 'parallel',
          states: {
            A: {
              initial: 'B',
              states: {
                B: {
                  on: { INNER_A: 'C' }
                },
                C: {
                  initial: 'D',
                  states: {
                    D: {},
                    E: {}
                  }
                },
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            K: {
              initial: 'L',
              states: {
                L: {},
                M: {},
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            deepHistory: {
              history: 'deep'
            }
          },
          on: {
            POWER: 'off'
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'INNER_A' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'DEEP_POWER' });

    expect(actorRef.getSnapshot().value).toEqual({
      on: {
        A: {
          C: 'D'
        },
        K: 'L'
      }
    });
  });

  it('should re-enter each regions of parallel state correctly', () => {
    const machine = createMachine({
      initial: 'off',
      states: {
        off: {
          on: {
            SWITCH: 'on',
            DEEP_POWER: 'on.deepHistory'
          }
        },
        on: {
          type: 'parallel',
          states: {
            A: {
              initial: 'B',
              states: {
                B: {
                  on: { INNER_A: 'C' }
                },
                C: {
                  initial: 'D',
                  states: {
                    D: {
                      on: { INNER_A: 'E' }
                    },
                    E: {}
                  }
                },
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            K: {
              initial: 'L',
              states: {
                L: {
                  on: { INNER_K: 'M' }
                },
                M: {
                  initial: 'N',
                  states: {
                    N: {
                      on: { INNER_K: 'O' }
                    },
                    O: {}
                  }
                },
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            hist: {
              history: true
            },
            shallowHistory: {
              history: 'shallow'
            },
            deepHistory: {
              history: 'deep'
            }
          },
          on: {
            POWER: 'off'
          }
        }
      }
    });
    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'INNER_A' });
    actorRef.send({ type: 'INNER_A' });
    actorRef.send({ type: 'INNER_K' });
    actorRef.send({ type: 'INNER_K' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'DEEP_POWER' });

    expect(actorRef.getSnapshot().value).toEqual({
      on: {
        A: { C: 'E' },
        K: { M: 'O' }
      }
    });
  });

  it('should re-enter multiple history states', () => {
    const machine = createMachine({
      initial: 'off',
      states: {
        off: {
          on: {
            SWITCH: 'on',
            PARALLEL_HISTORY: [{ target: ['on.A.hist', 'on.K.hist'] }]
          }
        },
        on: {
          type: 'parallel',
          states: {
            A: {
              initial: 'B',
              states: {
                B: {
                  on: { INNER_A: 'C' }
                },
                C: {
                  initial: 'D',
                  states: {
                    D: {
                      on: { INNER_A: 'E' }
                    },
                    E: {}
                  }
                },
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            K: {
              initial: 'L',
              states: {
                L: {
                  on: { INNER_K: 'M' }
                },
                M: {
                  initial: 'N',
                  states: {
                    N: {
                      on: { INNER_K: 'O' }
                    },
                    O: {}
                  }
                },
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            hist: {
              history: true
            },
            shallowHistory: {
              history: 'shallow'
            },
            deepHistory: {
              history: 'deep'
            }
          },
          on: {
            POWER: 'off'
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'INNER_A' });
    actorRef.send({ type: 'INNER_A' });
    actorRef.send({ type: 'INNER_K' });
    actorRef.send({ type: 'INNER_K' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'PARALLEL_HISTORY' });

    expect(actorRef.getSnapshot().value).toEqual({
      on: {
        A: { C: 'D' },
        K: { M: 'N' }
      }
    });
  });

  it('should re-enter a parallel with partial history', () => {
    const machine = createMachine({
      initial: 'off',
      states: {
        off: {
          on: {
            SWITCH: 'on',
            PARALLEL_SOME_HISTORY: [{ target: ['on.A.C', 'on.K.hist'] }]
          }
        },
        on: {
          type: 'parallel',
          states: {
            A: {
              initial: 'B',
              states: {
                B: {
                  on: { INNER_A: 'C' }
                },
                C: {
                  initial: 'D',
                  states: {
                    D: {
                      on: { INNER_A: 'E' }
                    },
                    E: {}
                  }
                },
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            K: {
              initial: 'L',
              states: {
                L: {
                  on: { INNER_K: 'M' }
                },
                M: {
                  initial: 'N',
                  states: {
                    N: {
                      on: { INNER_K: 'O' }
                    },
                    O: {}
                  }
                },
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            hist: {
              history: true
            },
            shallowHistory: {
              history: 'shallow'
            },
            deepHistory: {
              history: 'deep'
            }
          },
          on: {
            POWER: 'off'
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'INNER_A' });
    actorRef.send({ type: 'INNER_A' });
    actorRef.send({ type: 'INNER_K' });
    actorRef.send({ type: 'INNER_K' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'PARALLEL_SOME_HISTORY' });

    expect(actorRef.getSnapshot().value).toEqual({
      on: {
        A: { C: 'D' },
        K: { M: 'N' }
      }
    });
  });

  it('should re-enter a parallel with full history', () => {
    const machine = createMachine({
      initial: 'off',
      states: {
        off: {
          on: {
            SWITCH: 'on',
            PARALLEL_DEEP_HISTORY: [
              { target: ['on.A.deepHistory', 'on.K.deepHistory'] }
            ]
          }
        },
        on: {
          type: 'parallel',
          states: {
            A: {
              initial: 'B',
              states: {
                B: {
                  on: { INNER_A: 'C' }
                },
                C: {
                  initial: 'D',
                  states: {
                    D: {
                      on: { INNER_A: 'E' }
                    },
                    E: {}
                  }
                },
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            K: {
              initial: 'L',
              states: {
                L: {
                  on: { INNER_K: 'M' }
                },
                M: {
                  initial: 'N',
                  states: {
                    N: {
                      on: { INNER_K: 'O' }
                    },
                    O: {}
                  }
                },
                hist: { history: true },
                deepHistory: {
                  history: 'deep'
                }
              }
            },
            hist: {
              history: true
            },
            shallowHistory: {
              history: 'shallow'
            },
            deepHistory: {
              history: 'deep'
            }
          },
          on: {
            POWER: 'off'
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH' });
    actorRef.send({ type: 'INNER_A' });
    actorRef.send({ type: 'INNER_A' });
    actorRef.send({ type: 'INNER_K' });
    actorRef.send({ type: 'INNER_K' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'PARALLEL_DEEP_HISTORY' });

    expect(actorRef.getSnapshot().value).toEqual({
      on: {
        A: { C: 'E' },
        K: { M: 'O' }
      }
    });
  });
});

it('internal transition to a history state should enter default history state configuration if the containing state has never been exited yet', () => {
  const service = createActor(
    createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            NEXT: 'second.other'
          }
        },
        second: {
          initial: 'nested',
          states: {
            nested: {},
            other: {},
            hist: {
              history: true
            }
          },
          on: {
            NEXT: {
              target: '.hist'
            }
          }
        }
      }
    })
  ).start();

  service.send({ type: 'NEXT' });
  service.send({ type: 'NEXT' });

  expect(service.getSnapshot().value).toEqual({
    second: 'nested'
  });
});

describe('multistage history states', () => {
  it('should go to the most recently visited state', () => {
    const machine = createMachine({
      initial: 'running',
      states: {
        running: {
          initial: 'normal',
          states: {
            normal: {
              on: { SWITCH_TURBO: 'turbo' }
            },
            turbo: {
              on: { SWITCH_TURBO: 'normal' }
            },
            H: {
              history: true
            }
          },
          on: {
            POWER: 'off'
          }
        },
        starting: {
          on: { STARTED: 'running.H' }
        },
        off: {
          on: { POWER: 'starting' }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'SWITCH_TURBO' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'POWER' });
    actorRef.send({ type: 'STARTED' });

    expect(actorRef.getSnapshot().value).toEqual({
      running: 'turbo'
    });
  });
});
