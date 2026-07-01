import { createActor, createMachine } from '../src/index.ts';

describe('Initial states', () => {
  it('should support object syntax for initial', () => {
    const machine = createMachine({
      initial: { target: 'a' },
      states: {
        a: {},
        b: {}
      }
    });
    expect(createActor(machine).getSnapshot().value).toEqual('a');
  });

  it('should support nested object syntax for initial', () => {
    const machine = createMachine({
      initial: { target: 'a' },
      states: {
        a: {
          initial: { target: 'a1' },
          states: {
            a1: {},
            a2: {}
          }
        },
        b: {}
      }
    });
    expect(createActor(machine).getSnapshot().value).toEqual({ a: 'a1' });
  });

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
});
