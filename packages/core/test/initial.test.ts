import { createActor, createMachine } from '../src/index.ts';

describe('Initial states', () => {
  it('should return the correct initial state', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          initial: 'b',
          states: {
            b: {
              initial: 'c',
              states: {
                c: {}
              }
            }
          }
        },
        leaf: {}
      }
    });
    expect(createActor(machine).getSnapshot().value).toEqual({
      a: { b: 'c' }
    });
  });

  it('should return the correct initial state (parallel)', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        foo: {
          initial: 'a',
          states: {
            a: {
              initial: 'b',
              states: {
                b: {
                  initial: 'c',
                  states: {
                    c: {}
                  }
                }
              }
            },
            leaf: {}
          }
        },
        bar: {
          initial: 'a',
          states: {
            a: {
              initial: 'b',
              states: {
                b: {
                  initial: 'c',
                  states: {
                    c: {}
                  }
                }
              }
            },
            leaf: {}
          }
        }
      }
    });
    expect(createActor(machine).getSnapshot().value).toEqual({
      foo: { a: { b: 'c' } },
      bar: { a: { b: 'c' } }
    });
  });

  it('should return the correct initial state (deep parallel)', () => {
    const machine = createMachine({
      initial: 'one',
      states: {
        one: {
          type: 'parallel',
          states: {
            foo: {
              initial: 'a',
              states: {
                a: {
                  initial: 'b',
                  states: {
                    b: {
                      initial: 'c',
                      states: {
                        c: {}
                      }
                    }
                  }
                },
                leaf: {}
              }
            },
            bar: {
              initial: 'a',
              states: {
                a: {
                  initial: 'b',
                  states: {
                    b: {
                      initial: 'c',
                      states: {
                        c: {}
                      }
                    }
                  }
                },
                leaf: {}
              }
            }
          }
        },
        two: {
          type: 'parallel',
          states: {
            foo: {
              initial: 'a',
              states: {
                a: {
                  initial: 'b',
                  states: {
                    b: {
                      initial: 'c',
                      states: {
                        c: {}
                      }
                    }
                  }
                },
                leaf: {}
              }
            },
            bar: {
              initial: 'a',
              states: {
                a: {
                  initial: 'b',
                  states: {
                    b: {
                      initial: 'c',
                      states: {
                        c: {}
                      }
                    }
                  }
                },
                leaf: {}
              }
            }
          }
        }
      }
    });
    expect(createActor(machine).getSnapshot().value).toEqual({
      one: {
        foo: { a: { b: 'c' } },
        bar: { a: { b: 'c' } }
      }
    });
  });

  it('should resolve deep initial state', () => {
    const machine = createMachine({
      initial: '#deep_id',
      states: {
        foo: {
          initial: 'other',
          states: {
            other: {},
            deep: {
              id: 'deep_id'
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();
    expect(actorRef.getSnapshot().value).toEqual({ foo: 'deep' });
  });

  it('should resolve multiple deep initial states', () => {
    const machine = createMachine({
      initial: ['#foo_deep_id', '#bar_deep_id'],
      states: {
        root: {
          type: 'parallel',
          states: {
            foo: {
              initial: 'foo_other',
              states: {
                foo_other: {},
                foo_deep: {
                  id: 'foo_deep_id'
                }
              }
            },
            bar: {
              initial: 'bar_other',
              states: {
                bar_other: {},
                bar_deep: {
                  id: 'bar_deep_id'
                }
              }
            }
          }
        }
      }
    });
    const service = createActor(machine).start();
    expect(service.getSnapshot().value).toEqual({
      root: {
        foo: 'foo_deep',
        bar: 'bar_deep'
      }
    });
  });

  it('should not entry default initial state of the parent if deep state is targeted with initial', () => {
    let called = false;

    const machine = createMachine({
      initial: '#deep_id',
      states: {
        foo: {
          initial: 'other',
          states: {
            other: {
              entry: () => {
                called = true;
              }
            },
            deep: {
              id: 'deep_id'
            }
          }
        }
      }
    });
    createActor(machine).start();
    expect(called).toEqual(false);
  });
});
