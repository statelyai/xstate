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
});
