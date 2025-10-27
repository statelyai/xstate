import {
  next_createMachine,
  createActor,
  matchesState,
  StateValue,
  checkStateIn
} from '../src/index.ts';

describe('transition "in" check', () => {
  it('should transition if string state path matches current state value', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {
              on: {
                EVENT2: ({ value }) => {
                  if (matchesState({ b: 'b2' }, value)) {
                    return { target: 'a2' };
                  }
                }
              }
            },
            a2: {
              id: 'a_a2'
            }
          }
        },
        b: {
          initial: 'b2',
          states: {
            b1: {
              on: {
                // EVENT: {
                //   target: 'b2',
                //   guard: stateIn('#a_a2')
                // }
              }
            },
            b2: {
              id: 'b_b2',
              type: 'parallel',
              states: {
                foo: {
                  initial: 'foo2',
                  states: {
                    foo1: {},
                    foo2: {}
                  }
                },
                bar: {
                  initial: 'bar1',
                  states: {
                    bar1: {
                      id: 'bar1'
                    },
                    bar2: {}
                  }
                }
              }
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT2' });

    expect(actorRef.getSnapshot().value).toEqual({
      a: 'a2',
      b: {
        b2: {
          foo: 'foo2',
          bar: 'bar1'
        }
      }
    });
  });

  it('should transition if state node ID matches current state value', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {
              on: {
                // EVENT3: {
                //   target: 'a2',
                //   guard: stateIn('#b_b2')
                // }
                EVENT3: ({ self }) => {
                  if (checkStateIn(self.getSnapshot(), '#b_b2')) {
                    return { target: 'a2' };
                  }
                  // if (matchesState('#b_b2', value)) {
                  //   return { target: 'a2' };
                  // }
                }
              }
            },
            a2: {
              id: 'a_a2'
            }
          }
        },
        b: {
          initial: 'b2',
          states: {
            b1: {},
            b2: {
              id: 'b_b2',
              type: 'parallel',
              states: {
                foo: {
                  initial: 'foo2',
                  states: {
                    foo1: {},
                    foo2: {}
                  }
                },
                bar: {
                  initial: 'bar1',
                  states: {
                    bar1: {
                      id: 'bar1'
                    },
                    bar2: {}
                  }
                }
              }
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT3' });

    expect(actorRef.getSnapshot().value).toEqual({
      a: 'a2',
      b: {
        b2: {
          foo: 'foo2',
          bar: 'bar1'
        }
      }
    });
  });

  it('should not transition if string state path does not match current state value', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {
              on: {
                // EVENT1: {
                //   target: 'a2',
                //   guard: stateIn('b.b2')
                // }
                EVENT1: ({ value }) => {
                  if (matchesState('b.b2', value)) {
                    return { target: 'a2' };
                  }
                  // if (checkStateIn(self.getSnapshot(), 'b.b2')) {
                  //   return { target: 'a2' };
                  // }
                }
              }
            },
            a2: {
              id: 'a_a2'
            }
          }
        },
        b: {
          initial: 'b1',
          states: {
            b1: {},
            b2: {
              id: 'b_b2',
              type: 'parallel',
              states: {
                foo: {
                  initial: 'foo1',
                  states: {
                    foo1: {},
                    foo2: {}
                  }
                },
                bar: {
                  initial: 'bar1',
                  states: {
                    bar1: {
                      id: 'bar1'
                    },
                    bar2: {}
                  }
                }
              }
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT1' });

    expect(actorRef.getSnapshot().value).toEqual({
      a: 'a1',
      b: 'b1'
    });
  });

  it('should not transition if state value matches current state value', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {
              on: {
                // EVENT2: {
                //   target: 'a2',
                //   guard: stateIn({ b: 'b2' })
                // }
                EVENT2: ({ value }) => {
                  if (matchesState({ b: 'b2' }, value)) {
                    return { target: 'a2' };
                  }
                }
              }
            },
            a2: {
              id: 'a_a2'
            }
          }
        },
        b: {
          initial: 'b2',
          states: {
            b1: {},
            b2: {
              id: 'b_b2',
              type: 'parallel',
              states: {
                foo: {
                  initial: 'foo2',
                  states: {
                    foo1: {},
                    foo2: {}
                  }
                },
                bar: {
                  initial: 'bar1',
                  states: {
                    bar1: {
                      id: 'bar1'
                    },
                    bar2: {}
                  }
                }
              }
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT2' });

    expect(actorRef.getSnapshot().value).toEqual({
      a: 'a2',
      b: {
        b2: {
          foo: 'foo2',
          bar: 'bar1'
        }
      }
    });
  });

  it('matching should be relative to grandparent (match)', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {},
            a2: {
              id: 'a_a2'
            }
          }
        },
        b: {
          initial: 'b2',
          states: {
            b1: {},
            b2: {
              id: 'b_b2',
              type: 'parallel',
              states: {
                foo: {
                  initial: 'foo1',
                  states: {
                    foo1: {
                      on: {
                        EVENT_DEEP: ({ self }) => {
                          if (checkStateIn(self.getSnapshot(), '#bar1')) {
                            return { target: 'foo2' };
                          }
                        }
                      }
                    },
                    foo2: {}
                  }
                },
                bar: {
                  initial: 'bar1',
                  states: {
                    bar1: {
                      id: 'bar1'
                    },
                    bar2: {}
                  }
                }
              }
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT_DEEP' });

    expect(actorRef.getSnapshot().value).toEqual({
      a: 'a1',
      b: {
        b2: {
          foo: 'foo2',
          bar: 'bar1'
        }
      }
    });
  });

  it('matching should be relative to grandparent (no match)', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        a: {
          initial: 'a1',
          states: {
            a1: {},
            a2: {
              id: 'a_a2'
            }
          }
        },
        b: {
          initial: 'b2',
          states: {
            b1: {},
            b2: {
              id: 'b_b2',
              type: 'parallel',
              states: {
                foo: {
                  initial: 'foo1',
                  states: {
                    foo1: {
                      on: {
                        EVENT_DEEP: ({ self }) => {
                          if (checkStateIn(self.getSnapshot(), '#bar1')) {
                            return { target: 'foo2' };
                          }
                        }
                      }
                    },
                    foo2: {}
                  }
                },
                bar: {
                  initial: 'bar2',
                  states: {
                    bar1: {
                      id: 'bar1'
                    },
                    bar2: {}
                  }
                }
              }
            }
          }
        }
      }
    });
    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT_DEEP' });

    expect(actorRef.getSnapshot().value).toEqual({
      a: 'a1',
      b: {
        b2: {
          foo: 'foo1',
          bar: 'bar2'
        }
      }
    });
  });

  it('should work to forbid events', () => {
    const machine = next_createMachine({
      initial: 'green',
      states: {
        green: { on: { TIMER: 'yellow' } },
        yellow: { on: { TIMER: 'red' } },
        red: {
          initial: 'walk',
          states: {
            walk: {
              on: { TIMER: 'wait' }
            },
            wait: {
              on: { TIMER: 'stop' }
            },
            stop: {}
          },
          on: {
            // TIMER: [
            //   {
            //     target: 'green',
            //     guard: stateIn({ red: 'stop' })
            //   }
            // ]
            TIMER: ({ value }) => {
              if (matchesState({ red: 'stop' }, value)) {
                return { target: 'green' };
              }
            }
          }
        }
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'TIMER' });
    actorRef.send({ type: 'TIMER' });
    actorRef.send({ type: 'TIMER' });
    expect(actorRef.getSnapshot().value).toEqual({ red: 'wait' });

    actorRef.send({ type: 'TIMER' });
    expect(actorRef.getSnapshot().value).toEqual({ red: 'stop' });

    actorRef.send({ type: 'TIMER' });
    expect(actorRef.getSnapshot().value).toEqual('green');
  });

  it('should be possible to use a referenced `stateIn` guard', () => {
    const machine = next_createMachine({
      type: 'parallel',
      guards: {
        // hasSelection: stateIn('selected')
        hasSelection: (value: StateValue) => {
          return matchesState('selected', value);
        }
      },
      // machine definition,
      states: {
        selected: {},
        location: {
          initial: 'home',
          states: {
            home: {
              on: {
                NEXT: ({ guards, value }) => {
                  if (guards.hasSelection(value)) {
                    return {
                      target: 'success'
                    };
                  }
                }
              }
            },
            success: {}
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({
      type: 'NEXT'
    });
    expect(actor.getSnapshot().value).toEqual({
      selected: {},
      location: 'success'
    });
  });

  it.skip('should be possible to check an ID with a path', () => {
    const spy = vi.fn();
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A1',
          states: {
            A1: {
              on: {
                // MY_EVENT: {
                //   guard: stateIn('#b.B1'),
                //   actions: spy
                // }
                MY_EVENT: ({ value }, enq) => {
                  if (matchesState('#b.B1', value)) {
                    enq(spy);
                  }
                }
              }
            }
          }
        },
        B: {
          id: 'b',
          initial: 'B1',
          states: {
            B1: {}
          }
        }
      }
    });

    createActor(machine).start().send({
      type: 'MY_EVENT'
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
