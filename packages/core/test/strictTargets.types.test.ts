import { createMachine, setup, types } from '../src/index.ts';

describe('strict authored targets', () => {
  it('requires defaults for authored history states', () => {
    if (false) {
      // @ts-expect-error - authored history states require an SCXML default target
      createMachine({
        initial: 'flow',
        states: {
          flow: {
            initial: 'idle',
            states: {
              idle: {},
              history: { history: 'deep' }
            }
          }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('rejects empty history default target sets', () => {
    if (false) {
      // @ts-expect-error - an SCXML default transition needs at least one target
      createMachine({
        initial: 'flow',
        states: {
          flow: {
            initial: 'idle',
            states: {
              idle: {},
              history: { type: 'history', target: [] }
            }
          }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('rejects an unknown literal descendant target', () => {
    const s = setup({
      schemas: {
        events: {
          GO: types<{}>()
        }
      },
      states: {
        flow: {
          states: {
            idle: {},
            done: {}
          }
        }
      }
    });

    if (false) {
      // @ts-expect-error - `.missing` is not a descendant of `flow`
      s.createMachine({
        initial: 'flow',
        states: {
          flow: {
            initial: 'idle',
            on: {
              GO: { target: '.missing' }
            },
            states: {
              idle: {},
              done: {}
            }
          }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('rejects an unknown literal state ID target', () => {
    const s = setup({
      schemas: { events: { GO: types<{}>() } },
      states: { idle: {}, done: {} }
    });

    if (false) {
      s.createMachine({
        id: 'root',
        initial: 'idle',
        states: {
          idle: {
            on: {
              // @ts-expect-error - no state declares the ID `missing`
              GO: {
                target: '#missing'
              }
            }
          },
          done: { id: 'finished' }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('rejects literal target sets that select two children of one compound state', () => {
    if (false) {
      // @ts-expect-error - `left` is compound and cannot activate both children
      createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: {
              GO: { target: ['parallel.left.a', 'parallel.left.b'] }
            }
          },
          parallel: {
            type: 'parallel',
            states: {
              left: { initial: 'a', states: { a: {}, b: {} } },
              right: { initial: 'c', states: { c: {}, d: {} } }
            }
          }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('accepts a legal partial or complete parallel target specification', () => {
    createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            PARTIAL: { target: 'parallel.left.b' },
            COMPLETE: {
              target: ['parallel.left.b', 'parallel.right.d']
            }
          }
        },
        parallel: {
          type: 'parallel',
          states: {
            left: { initial: 'a', states: { a: {}, b: {} } },
            right: { initial: 'c', states: { c: {}, d: {} } }
          }
        }
      }
    });

    expect(true).toBe(true);
  });

  it('rejects a target set containing an ancestor and its descendant', () => {
    if (false) {
      // @ts-expect-error - a legal SCXML target set cannot contain an ancestor and descendant
      createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: { GO: { target: ['parallel.left', 'parallel.left.b'] } }
          },
          parallel: {
            type: 'parallel',
            states: {
              left: { initial: 'a', states: { a: {}, b: {} } },
              right: { initial: 'c', states: { c: {}, d: {} } }
            }
          }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('rejects a target set spanning different top-level roots', () => {
    if (false) {
      // @ts-expect-error - an SCXML configuration contains exactly one root child
      createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: { GO: { target: ['first.a', 'second.b'] } }
          },
          first: { initial: 'a', states: { a: {} } },
          second: { initial: 'b', states: { b: {} } }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('rejects an unknown literal returned from a transition function', () => {
    const s = setup({
      schemas: { events: { GO: types<{}>() } },
      states: {
        flow: { states: { idle: {}, done: {} } }
      }
    });

    if (false) {
      // @ts-expect-error - the returned descendant target does not exist
      s.createMachine({
        initial: 'flow',
        states: {
          flow: {
            initial: 'idle',
            on: { GO: () => ({ target: '.missing' }) },
            states: { idle: {}, done: {} }
          }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('rejects an unknown literal initial target', () => {
    if (false) {
      // @ts-expect-error - `missing` is not a child of `flow`
      createMachine({
        initial: 'flow',
        states: {
          flow: {
            initial: 'missing',
            states: { idle: {}, done: {} }
          }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('accepts a legal multi-target default for deep parallel history', () => {
    createMachine({
      initial: 'parallel',
      states: {
        parallel: {
          type: 'parallel',
          states: {
            left: { initial: 'a', states: { a: {}, b: {} } },
            right: { initial: 'c', states: { c: {}, d: {} } },
            history: {
              type: 'history',
              history: 'deep',
              target: ['left.b', 'right.d']
            }
          }
        }
      }
    });

    expect(true).toBe(true);
  });

  it('resolves bare targets as siblings of source keys containing dots', () => {
    createMachine({
      // Initial values are direct child keys, not state-path expressions.
      initial: 'foo.bar',
      states: {
        'foo.bar': {
          on: { NEXT: { target: 'done' } }
        },
        done: {}
      }
    });

    expect(true).toBe(true);
  });

  it('resolves escaped dots in target paths as literal key dots', () => {
    createMachine({
      initial: 'start',
      states: {
        start: { on: { NEXT: { target: 'foo\\.bar' } } },
        'foo.bar': {},
        foo: { initial: 'bar', states: { bar: {} } }
      }
    });

    expect(true).toBe(true);
  });

  it('applies SCXML target-set legality to state ID targets', () => {
    if (false) {
      // @ts-expect-error - both IDs select children of the same compound state
      createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: { INVALID: { target: ['#leftA', '#leftB'] } }
          },
          parallel: {
            type: 'parallel',
            states: {
              left: {
                initial: 'a',
                states: {
                  a: { id: 'leftA' },
                  b: { id: 'leftB' }
                }
              },
              right: {
                initial: 'c',
                states: {
                  c: { id: 'rightC' },
                  d: { id: 'rightD' }
                }
              }
            }
          }
        }
      });
    }

    createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: { VALID: { target: ['#leftB', '#rightD'] } }
        },
        parallel: {
          type: 'parallel',
          states: {
            left: {
              initial: 'a',
              states: { a: { id: 'leftA' }, b: { id: 'leftB' } }
            },
            right: {
              initial: 'c',
              states: { c: { id: 'rightC' }, d: { id: 'rightD' } }
            }
          }
        }
      }
    });

    expect(true).toBe(true);
  });

  it('localizes validation escape hatches to opaque state subtrees', () => {
    const opaqueState = {} as any;

    if (false) {
      // @ts-expect-error - an opaque sibling does not disable concrete validation
      createMachine({
        initial: 'idle',
        states: {
          idle: { on: { GO: { target: 'missing' } } },
          opaque: opaqueState
        }
      });
    }

    if (false) {
      createMachine({
        initial: 'idle',
        states: {
          idle: { on: { GO: { target: 'opaque.dynamicChild' } } },
          opaque: opaqueState
        }
      });
    }

    expect(true).toBe(true);
  });
});
