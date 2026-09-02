import { createActor, createAsyncLogic, setup, types } from '../src/index.ts';
import type { StateValueFrom } from '../src/types.ts';

describe('setup state contracts', () => {
  it('carries declared state types through machine state values and runtime nodes', () => {
    const s = setup({
      states: {
        active: {
          type: 'parallel',
          id: 'active-state',
          states: {
            playback: {
              type: 'compound',
              initial: 'stopped',
              states: {
                // Preserved local autocomplete probe (no target selected):
                // always: { target: }
                stopped: {},
                playing: {}
              }
            },
            volume: {
              type: 'compound',
              initial: 'audible',
              states: {
                audible: {},
                muted: {}
              }
            }
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'active',
      states: {
        active: {
          states: {
            playback: {
              states: {
                stopped: {},
                playing: {}
              }
            },
            volume: {
              states: {
                audible: {},
                muted: {}
              }
            }
          }
        }
      }
    });

    type MachineStateValue = StateValueFrom<typeof machine>;
    const stateValue = {
      active: { playback: 'stopped', volume: 'audible' }
    } satisfies MachineStateValue;

    expect(machine.states.active.type).toBe('parallel');
    expect(machine.states.active.id).toBe('active-state');
    expect(machine.states.active.states.playback.type).toBe('compound');
    expect(machine.states.active.states.playback.config.initial).toBe(
      'stopped'
    );
    expect(stateValue).toEqual({
      active: { playback: 'stopped', volume: 'audible' }
    });
  });

  it('inherits history defaults from setup state contracts', () => {
    const machine = setup({
      states: {
        parent: {
          initial: 'idle',
          states: {
            idle: {},
            hist: {
              type: 'history',
              target: 'idle'
            }
          }
        }
      }
    }).createMachine({
      initial: 'parent',
      states: {
        parent: {
          states: {
            idle: {},
            hist: {}
          }
        }
      }
    });

    expect(machine.states.parent.states.hist.type).toBe('history');
    expect(machine.states.parent.states.hist.config.target).toBe('idle');
  });

  it('treats setup history metadata as a history node without a type', () => {
    const s = setup({
      states: {
        parent: {
          type: 'compound',
          initial: 'idle',
          states: {
            idle: {},
            hist: { history: true, target: 'idle' }
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'parent',
      states: {
        parent: {
          states: { idle: {}, hist: {} }
        }
      }
    });

    expect(machine.states.parent.states.hist.type).toBe('history');
  });

  it('keeps child input typing on setup-declared compound initials', () => {
    const s = setup({
      schemas: { context: types<{ value: number }>() },
      states: {
        parent: {
          type: 'compound',
          initial: 'child',
          states: {
            child: { schemas: { input: types<{ id: number }>() } }
          }
        }
      }
    });

    s.createMachine({
      context: { value: 1 },
      initial: 'parent',
      states: {
        parent: {
          initial: {
            target: 'child',
            input: ({ context }) => {
              context.value satisfies number;
              // @ts-expect-error - initial context is not a string
              const value: string = context.value;
              void value;
              return { id: context.value };
            }
          },
          states: { child: {} }
        }
      }
    });

    if (false) {
      s.createMachine({
        context: { value: 1 },
        initial: 'parent',
        states: {
          parent: {
            initial: {
              target: 'child',
              // @ts-expect-error - the setup child input requires a number
              input: { id: 'wrong' }
            },
            states: { child: {} }
          }
        }
      });
    }
  });

  it('requires input for every explicitly entered composite state', () => {
    const s = setup({
      schemas: { events: { GO: types<{}>() } },
      states: {
        idle: {},
        parent: {
          type: 'compound',
          initial: 'child',
          schemas: { input: types<{ parentId: string }>() },
          states: {
            child: { schemas: { input: types<{ childId: number }>() } }
          }
        },
        active: {
          type: 'parallel',
          schemas: { input: types<{ sessionId: string }>() },
          states: {
            left: {
              type: 'compound',
              initial: 'leaf',
              states: {
                leaf: { schemas: { input: types<{ leftId: number }>() } }
              }
            },
            right: {
              type: 'compound',
              initial: 'leaf',
              states: {
                leaf: { schemas: { input: types<{ rightId: boolean }>() } }
              }
            }
          }
        }
      }
    });

    s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: { target: 'parent', input: { parentId: 'p1' } }
          }
        },
        parent: {
          initial: { target: 'child', input: { childId: 1 } },
          states: { child: {} }
        },
        active: {
          states: {
            left: {
              initial: { target: 'leaf', input: { leftId: 1 } },
              states: { leaf: {} }
            },
            right: {
              initial: { target: 'leaf', input: { rightId: true } },
              states: { leaf: {} }
            }
          }
        }
      }
    });

    if (false as boolean) {
      s.createMachine({
        // @ts-expect-error - a root initial transition to parent needs parentId
        initial: { target: 'parent' },
        states: {
          parent: {
            initial: { target: 'child', input: { childId: 1 } },
            states: { child: {} }
          }
        }
      });

      s.createMachine({
        // @ts-expect-error - a structural parent with required input cannot use a bare initial target
        initial: 'parent',
        states: {
          parent: {
            initial: { target: 'child', input: { childId: 1 } },
            states: { child: {} }
          }
        }
      });
    }

    if (false as boolean) {
      s.createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: {
              // @ts-expect-error - entering parent requires parentId
              GO: {
                target: 'parent',
                input: {}
              }
            }
          },
          parent: {
            // @ts-expect-error - the initial child requires childId
            initial: 'child',
            states: { child: {} }
          }
        }
      });

      s.createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: {
              GO: { target: 'active', input: { sessionId: 's1' } }
            }
          },
          active: {
            states: {
              left: {
                // @ts-expect-error - the left initial child requires leftId
                initial: 'leaf',
                states: { leaf: {} }
              },
              right: {
                initial: { target: 'leaf', input: { rightId: true } },
                states: { leaf: {} }
              }
            }
          }
        }
      });
    }
  });

  it('validates setup-declared history targets and ids', () => {
    const valid = setup({
      states: {
        parent: {
          type: 'compound',
          initial: 'idle',
          states: {
            idle: {},
            hist: { type: 'history', target: 'idle' },
            done: { id: 'done-state' }
          }
        }
      }
    });

    valid.createMachine({
      initial: 'parent',
      states: {
        parent: {
          states: {
            idle: {},
            hist: {},
            done: { on: { RESET: { target: '#done-state' } } }
          }
        }
      }
    });

    valid.createStateConfig('parent.hist', { target: 'idle' });

    if (false) {
      valid.createStateConfig('parent.hist', {
        // @ts-expect-error - history targets must use declared state IDs
        target: '#missing'
      });
    }

    if (false) {
      valid.createMachine({
        initial: 'parent',
        states: {
          parent: {
            states: {
              idle: {},
              // @ts-expect-error - history nodes cannot have child states
              hist: { type: 'history', states: { child: {} } }
            }
          }
        }
      });
    }

    const invalid = setup({
      states: {
        parent: {
          type: 'compound',
          initial: 'idle',
          states: {
            idle: {},
            hist: { type: 'history', target: 'missing' }
          }
        }
      }
    });

    if (false) {
      // @ts-expect-error - setup history defaults must target a real state
      invalid.createMachine({
        initial: 'parent',
        states: {
          parent: { states: { idle: {}, hist: {} } }
        }
      });
    }

    const historyWithInputTarget = setup({
      states: {
        parent: {
          type: 'compound',
          initial: 'idle',
          states: {
            idle: {},
            loaded: {
              schemas: { input: types<{ token: string }>() }
            },
            hist: { type: 'history', target: 'loaded' }
          }
        }
      }
    });

    if (false as boolean) {
      historyWithInputTarget.createMachine({
        initial: 'parent',
        states: {
          parent: {
            states: {
              idle: {},
              // @ts-expect-error - history defaults cannot provide loaded input
              hist: {},
              loaded: {}
            }
          }
        }
      });
    }

    historyWithInputTarget.createMachine({
      initial: 'parent',
      states: {
        parent: {
          states: {
            idle: {},
            hist: { target: 'idle' },
            loaded: {}
          }
        }
      }
    });

    if (false as boolean) {
      historyWithInputTarget.createMachine({
        initial: 'parent',
        states: {
          parent: {
            states: {
              idle: {},
              // @ts-expect-error - authored history targets still require input
              hist: { target: 'loaded' },
              loaded: {}
            }
          }
        }
      });
    }

    const historyWithNestedInitialInputs = setup({
      states: {
        parent: {
          type: 'compound',
          initial: 'idle',
          states: {
            idle: {},
            active: {
              type: 'parallel',
              states: {
                left: {
                  type: 'compound',
                  initial: 'leaf',
                  states: {
                    leaf: { schemas: { input: types<{ id: number }>() } }
                  }
                },
                right: {
                  type: 'compound',
                  initial: 'leaf',
                  states: {
                    leaf: { schemas: { input: types<{ ready: boolean }>() } }
                  }
                }
              }
            },
            hist: { type: 'history', target: 'active' }
          }
        }
      }
    });

    historyWithNestedInitialInputs.createMachine({
      initial: 'parent',
      states: {
        parent: {
          states: {
            idle: {},
            active: {
              states: {
                left: {
                  initial: { target: 'leaf', input: { id: 1 } },
                  states: { leaf: {} }
                },
                right: {
                  initial: { target: 'leaf', input: { ready: true } },
                  states: { leaf: {} }
                }
              }
            },
            hist: {}
          }
        }
      }
    });
  });

  it('requires the structural fields declared by setup', () => {
    const parallel = setup({
      states: {
        active: {
          type: 'parallel'
        }
      }
    });

    if (false) {
      parallel.createMachine({
        initial: 'active',
        states: {
          active: {
            // @ts-expect-error - parallel states cannot have an initial state
            initial: 'left',
            states: { left: {} }
          }
        }
      });
    }

    const compound = setup({
      states: {
        active: {
          type: 'compound'
        }
      }
    });

    if (false) {
      compound.createMachine({
        initial: 'active',
        states: {
          // @ts-expect-error - a declared compound state needs an initial
          active: { states: { idle: {} } }
        }
      });
    }

    const compoundWithChildren = setup({
      states: {
        active: {
          type: 'compound',
          initial: 'idle',
          states: { idle: {} }
        }
      }
    });

    if (false) {
      compoundWithChildren.createMachine({
        initial: 'active',
        states: {
          // @ts-expect-error - declared compound children must be authored
          active: {}
        }
      });
    }

    const incompatible = setup({
      states: {
        active: {
          type: 'parallel'
        }
      }
    });

    if (false) {
      incompatible.createMachine({
        initial: 'active',
        states: {
          active: {
            // @ts-expect-error - the machine config cannot contradict setup
            type: 'compound',
            states: { idle: {} }
          }
        }
      });
    }

    const final = setup({
      states: { done: { type: 'final' } }
    });

    final.createMachine({
      initial: 'done',
      states: { done: { output: { ok: true } } }
    });

    if (false) {
      final.createMachine({
        initial: 'done',
        states: {
          done: {
            // @ts-expect-error - final states cannot have child states
            states: { child: {} }
          }
        }
      });
    }

    const choice = setup({
      schemas: { context: types<{ value: number }>() },
      states: { route: { type: 'choice' } }
    });

    choice.createMachine({
      context: { value: 0 },
      initial: 'route',
      states: {
        route: {
          choice: ({ context }) => {
            context.value satisfies number;
            // @ts-expect-error - choice context is not a string
            const value: string = context.value;
            void value;
            return { target: 'done' };
          }
        },
        done: { type: 'final' }
      }
    });

    if (false) {
      choice.createMachine({
        initial: 'route',
        states: {
          // @ts-expect-error - choice states require a choice function
          route: {
            type: 'choice'
          },
          done: { type: 'final' }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('retains current permissive setup schemas without structural metadata', () => {
    setup({
      states: {
        active: {
          schemas: {}
        }
      }
    }).createMachine({
      initial: 'active',
      states: {
        active: {}
      }
    });

    expect(true).toBe(true);
  });

  it('narrows relative targets for atomic states', () => {
    const s = setup({
      states: {
        active: {},
        inactive: {}
      }
    });

    s.createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            SELF: { target: '.' },
            TO_ACTIVE: { target: 'active' },
            TO_INACTIVE: { target: 'inactive' }
          }
        },
        inactive: {}
      }
    });

    if (false) {
      s.createMachine({
        initial: 'active',
        states: {
          active: {
            on: {
              // @ts-expect-error - an atomic state has no relative children
              EVENT: { target: '.inactive' }
            }
          },
          inactive: {}
        }
      });
    }

    expect(true).toBe(true);
  });

  it('requires root transitions to use root-relative targets', () => {
    const s = setup({
      schemas: { events: { GO: types<{}>() } },
      states: { active: {}, inactive: {} }
    });

    s.createMachine({
      initial: 'active',
      on: { GO: { target: '.inactive' } },
      states: { active: {}, inactive: {} }
    });

    if (false) {
      s.createMachine({
        initial: 'active',
        on: {
          // @ts-expect-error - root transitions require a dot-relative target
          GO: {
            target: 'inactive'
          }
        },
        states: { active: {}, inactive: {} }
      });
    }

    expect(true).toBe(true);
  });

  it('types root invoke completion targets as root-relative targets', () => {
    const s = setup({
      actors: {
        worker: createAsyncLogic({ run: async () => undefined })
      },
      states: {
        idle: {},
        done: { schemas: { input: types<{ id: number }>() } }
      }
    });

    s.createMachine({
      initial: 'idle',
      invoke: {
        src: 'worker',
        onDone: { target: '.done', input: { id: 1 } }
      },
      states: { idle: {}, done: {} }
    });

    if (false) {
      s.createMachine({
        initial: 'idle',
        // @ts-expect-error - root invoke completion targets are dot-relative
        invoke: {
          src: 'worker',
          onDone: { target: 'done', input: { id: 1 } }
        },
        states: { idle: {}, done: {} }
      });
    }
  });

  it('preserves escaped dots in setup state paths', () => {
    const s = setup({
      schemas: { events: { GO: types<{}>(), ID: types<{}>() } },
      states: {
        active: {
          type: 'compound',
          initial: 'idle',
          id: 'active.id',
          states: {
            'foo.bar': {
              type: 'atomic',
              id: 'node.id',
              schemas: { input: types<{ id: number }>() }
            },
            idle: { type: 'atomic' }
          }
        }
      }
    });

    s.createStateConfig('active.idle', {
      on: {
        GO: {
          target: 'foo\\.bar',
          input: { id: 1 }
        },
        ID: {
          target: '#node\\.id',
          input: { id: 1 }
        }
      }
    });

    s.createStateConfig('active.foo\\.bar', {
      entry: ({ input }) => {
        input.id satisfies number;
      }
    });

    if (false) {
      s.createStateConfig('active.idle', {
        on: {
          // @ts-expect-error - a literal dot in a state key must be escaped
          GO: { target: '.foo.bar', input: { id: 1 } }
        }
      });
    }

    s.createMachine({
      initial: 'active',
      states: {
        active: {
          initial: 'idle',
          states: {
            'foo.bar': {},
            idle: {
              on: {
                ID: { target: '#node\\.id', input: { id: 1 } }
              }
            }
          }
        }
      }
    });

    s.createMachine({
      initial: { target: '#active\\.id' },
      states: {
        active: {
          initial: 'idle',
          states: {
            'foo.bar': {},
            idle: {}
          }
        }
      }
    });

    if (false) {
      s.createMachine({
        initial: 'active',
        states: {
          active: {
            initial: 'idle',
            states: {
              'foo.bar': {},
              idle: {
                on: {
                  // @ts-expect-error - dots in IDs must be escaped
                  ID: { target: '#node.id', input: { id: 1 } }
                }
              }
            }
          }
        }
      });
    }
  });

  it('types choice targets and their target inputs from setup', () => {
    const s = setup({
      schemas: { context: types<{ value: number }>() },
      states: {
        route: { type: 'choice' },
        done: { schemas: { input: types<{ token: string }>() } },
        active: {
          type: 'parallel',
          states: {
            left: { schemas: { input: types<{ leftId: number }>() } },
            right: { schemas: { input: types<{ rightId: boolean }>() } }
          }
        },
        other: { schemas: { input: types<{ otherId: string }>() } }
      }
    });

    s.createMachine({
      context: { value: 1 },
      initial: 'route',
      states: {
        route: {
          choice: ({ context }) => {
            context.value satisfies number;
            return { target: 'done', input: { token: 'ok' } };
          }
        },
        done: {},
        active: {
          states: {
            left: {},
            right: {}
          }
        },
        other: {}
      }
    });

    s.createMachine({
      context: { value: 1 },
      initial: 'route',
      states: {
        route: {
          choice: () => ({
            target: ['active.left', 'active.right'],
            input: { leftId: 1, rightId: true }
          })
        },
        active: { states: { left: {}, right: {} } },
        other: {},
        done: {}
      }
    });

    if (false) {
      s.createMachine({
        context: { value: 1 },
        initial: 'route',
        states: {
          route: {
            // @ts-expect-error - choice targets must exist in setup
            choice: () => ({
              target: 'missing'
            })
          },
          done: {}
        }
      });

      s.createMachine({
        context: { value: 1 },
        initial: 'route',
        states: {
          route: {
            // @ts-expect-error - the choice target requires its input
            choice: () => ({
              target: 'done'
            })
          },
          done: {}
        }
      });

      s.createMachine({
        context: { value: 1 },
        initial: 'route',
        states: {
          route: {
            // @ts-expect-error - choice target sets require every target input
            choice: () => ({
              target: ['active.left', 'active.right'],
              input: { leftId: 1 }
            })
          },
          active: { states: { left: {}, right: {} } },
          other: {},
          done: {}
        }
      });
    }

    expect(true).toBe(true);
  });

  it('requires self-reentry transitions to provide current state input', () => {
    const s = setup({
      schemas: { events: { GO: types<{}>() } },
      states: {
        active: { schemas: { input: types<{ id: number }>() } }
      }
    });

    s.createMachine({
      initial: { target: 'active', input: { id: 0 } },
      states: {
        active: {
          on: {
            GO: { target: '.', reenter: true, input: { id: 1 } }
          }
        }
      }
    });

    if (false) {
      s.createMachine({
        initial: { target: 'active', input: { id: 0 } },
        states: {
          active: {
            on: {
              // @ts-expect-error - self-reentry requires the current state input
              GO: {
                target: '.',
                reenter: true
              }
            }
          }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('uses setup parallel metadata when validating authored target sets', () => {
    const s = setup({
      schemas: { events: { RESET: types<{}>() } },
      states: {
        active: {
          type: 'parallel',
          states: {
            left: {
              type: 'compound',
              initial: 'idle',
              states: { idle: {}, done: {} }
            },
            right: {
              type: 'compound',
              initial: 'idle',
              states: { idle: {}, done: {} }
            }
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'active',
      on: {
        RESET: { target: ['.active.left.done', '.active.right.done'] }
      },
      states: {
        active: {
          states: {
            left: { states: { idle: {}, done: {} } },
            right: { states: { idle: {}, done: {} } }
          }
        }
      }
    });

    expect(machine.states.active.type).toBe('parallel');
  });

  it('keeps standalone target sets aligned with statechart topology', () => {
    const s = setup({
      schemas: { events: { DONE: types<{}>() } },
      states: {
        active: {
          type: 'parallel',
          states: {
            left: {
              type: 'compound',
              initial: 'idle',
              states: { idle: {}, done: {} }
            },
            right: {
              type: 'compound',
              initial: 'idle',
              states: { idle: {}, done: {} }
            }
          }
        }
      }
    });

    s.createStateConfig('active', {
      on: {
        DONE: { target: ['.left.idle', '.right.idle'] }
      },
      states: {
        left: { states: { idle: {}, done: {} } },
        right: { states: { idle: {}, done: {} } }
      }
    });

    if (false) {
      s.createStateConfig('active.left', {
        on: {
          // @ts-expect-error - target sets cannot select two children of one compound state
          DONE: { target: ['.idle', '.done'] }
        },
        states: { idle: {}, done: {} }
      });

      s.createStateConfig('active.left', {
        on: {
          // @ts-expect-error - an invalid target set cannot hide in a transition array
          DONE: [{ target: ['.idle', '.done'] }, { target: '.idle' }]
        },
        states: { idle: {}, done: {} }
      });
    }
  });

  it('keeps transitions on parallel regions scoped to their own children', () => {
    const s = setup({
      schemas: { events: { DONE: types<{}>() } },
      states: {
        active: {
          type: 'parallel',
          states: {
            left: {
              type: 'compound',
              initial: 'idle',
              states: { idle: {}, done: {} }
            },
            right: {
              type: 'compound',
              initial: 'idle',
              states: { idle: {}, done: {} }
            }
          }
        }
      }
    });

    s.createMachine({
      initial: 'active',
      states: {
        active: {
          states: {
            left: {
              on: { DONE: { target: '.done' } },
              states: { idle: {}, done: {} }
            },
            right: { states: { idle: {}, done: {} } }
          }
        }
      }
    });

    if (false) {
      s.createMachine({
        initial: 'active',
        states: {
          active: {
            states: {
              left: {
                on: {
                  // @ts-expect-error - a parallel region cannot target its sibling region by name
                  DONE: { target: 'right' }
                },
                states: { idle: {}, done: {} }
              },
              right: { states: { idle: {}, done: {} } }
            }
          }
        }
      });
    }
  });

  it('keeps target-set input typing for parallel-region self targets', () => {
    const s = setup({
      schemas: { events: { REFRESH: types<{}>() } },
      states: {
        active: {
          type: 'parallel',
          states: {
            left: { schemas: { input: types<{ id: number }>() } },
            right: {}
          }
        }
      }
    });

    s.createMachine({
      initial: 'active',
      states: {
        active: {
          states: {
            left: {
              on: {
                REFRESH: { target: ['.'], input: { id: 1 } }
              }
            },
            right: {}
          }
        }
      }
    });

    if (false) {
      s.createMachine({
        initial: 'active',
        states: {
          active: {
            states: {
              left: {
                on: {
                  REFRESH: {
                    target: ['.'],
                    // @ts-expect-error - the self target still requires its input
                    input: {}
                  }
                }
              },
              right: {}
            }
          }
        }
      });
    }
  });

  it('correlates nested setup targets with their context and input schemas', () => {
    const s = setup({
      schemas: {
        context: types<{ mode: 'idle' } | { mode: 'done'; code: number }>(),
        events: {
          GO: types<{}>(),
          CHILD: types<{}>(),
          GRANDCHILD: types<{}>(),
          NESTED_ID: types<{}>()
        }
      },
      states: {
        parent: {
          id: 'parent-id',
          initial: 'idle',
          states: {
            idle: {},
            child: {
              schemas: { input: types<{ childToken: number }>() }
            },
            flow: {
              id: 'flow-id',
              type: 'compound',
              initial: 'ready',
              states: {
                ready: {},
                done: {
                  id: 'done-state',
                  schemas: {
                    context: types<{ mode: 'done'; code: number }>(),
                    input: types<{ token: string }>()
                  }
                }
              }
            },
            foo: {
              type: 'compound',
              initial: 'grandchild',
              states: {
                grandchild: {
                  schemas: { input: types<{ grandchildToken: boolean }>() }
                }
              }
            }
          }
        }
      }
    });

    s.createStateConfig('parent', {
      on: {
        CHILD: {
          target: '.child',
          input: { childToken: 1 }
        },
        GRANDCHILD: {
          target: '.foo.grandchild',
          input: { grandchildToken: true }
        },
        GO: {
          target: '#parent-id.flow.done',
          context: { mode: 'done', code: 1 },
          input: { token: 'ready' }
        },
        NESTED_ID: {
          target: '#flow-id.done',
          context: { mode: 'done', code: 1 },
          input: { token: 'ready' }
        }
      }
    });

    if (false) {
      s.createStateConfig('parent', {
        on: {
          // @ts-expect-error - descendants after nested IDs must be known
          NESTED_ID: { target: '#flow-id.missing' }
        }
      });
    }

    const machineSetup = setup({
      schemas: {
        events: {
          CHILD: types<{}>(),
          GRANDCHILD: types<{}>()
        }
      },
      states: {
        parent: {
          type: 'compound',
          initial: 'idle',
          states: {
            idle: {},
            child: {
              schemas: { input: types<{ childToken: number }>() }
            },
            foo: {
              type: 'compound',
              initial: 'grandchild',
              states: {
                grandchild: {
                  schemas: { input: types<{ grandchildToken: boolean }>() }
                }
              }
            }
          }
        }
      }
    });

    machineSetup.createMachine({
      initial: 'parent',
      states: {
        parent: {
          initial: 'idle',
          on: {
            CHILD: { target: '.child', input: { childToken: 1 } },
            GRANDCHILD: {
              target: '.foo.grandchild',
              input: { grandchildToken: true }
            }
          },
          states: {
            idle: {},
            child: {},
            foo: {
              initial: {
                target: 'grandchild',
                input: { grandchildToken: true }
              },
              states: { grandchild: {} }
            }
          }
        }
      }
    });

    s.createStateConfig('parent', {
      on: {
        GO: {
          target: '#done-state',
          context: { mode: 'done', code: 1 },
          input: { token: 'ready' }
        }
      }
    });

    if (false as boolean) {
      s.createStateConfig('parent', {
        on: {
          // @ts-expect-error - nested target input is required to be typed
          GO: {
            target: '.flow.done',
            input: { token: 1 },
            context: { mode: 'done', code: 1 }
          }
        }
      });

      s.createStateConfig('parent', {
        on: {
          // @ts-expect-error - `.child` requires childToken to be a number
          CHILD: { target: '.child', input: { childToken: 'wrong' } },
          // @ts-expect-error - `.foo.grandchild` requires grandchildToken
          GRANDCHILD: { target: '.foo.grandchild', input: {} }
        }
      });

      machineSetup.createMachine({
        initial: 'parent',
        states: {
          parent: {
            on: {
              // @ts-expect-error - machine relative targets use the source state's input schema
              CHILD: { target: '.child', input: { childToken: 'wrong' } }
            },
            states: {
              idle: {},
              child: {},
              foo: {
                initial: {
                  target: 'grandchild',
                  input: { grandchildToken: true }
                },
                states: { grandchild: {} }
              }
            }
          }
        }
      });
    }

    expect(true).toBe(true);
  });

  it('resolves root IDs from nested state transitions', () => {
    const s = setup({
      schemas: { events: { GO: types<{}>() } },
      states: {
        one: {
          type: 'compound',
          initial: 'idle',
          states: { idle: {} }
        },
        two: {
          type: 'compound',
          initial: 'idle',
          states: {
            idle: {},
            done: {
              id: 'two-done',
              schemas: { input: types<{ token: string }>() }
            }
          }
        }
      }
    });

    s.createStateConfig('one.idle', {
      on: { GO: { target: '#two-done', input: { token: 'ready' } } }
    });

    const machine = s.createMachine({
      initial: 'one',
      states: {
        one: {
          states: {
            idle: {
              on: {
                GO: { target: '#two-done', input: { token: 'ready' } }
              }
            }
          }
        },
        two: {
          states: { idle: {}, done: {} }
        }
      }
    });

    if (false as boolean) {
      s.createStateConfig('one.idle', {
        on: {
          // @ts-expect-error - root IDs must be declared in the setup tree
          GO: { target: '#missing', input: { token: 'ready' } }
        }
      });
    }

    expect(machine.states.two.states.done.id).toBe('two-done');
  });

  it('passes state input to invoke input callbacks', () => {
    const seen: Array<{ token: string }> = [];
    const worker = createAsyncLogic<undefined, { token: string }>({
      run: async ({ input }) => {
        seen.push(input);
        return undefined;
      }
    });

    const machine = setup({
      actors: { worker },
      states: {
        working: {
          schemas: { input: types<{ token: string }>() }
        }
      }
    }).createMachine({
      initial: { target: 'working', input: { token: 'abc' } },
      states: {
        working: {
          invoke: {
            src: 'worker',
            input: ({ input }) => {
              input.token satisfies string;
              return input;
            }
          }
        }
      }
    });

    createActor(machine).start();

    expect(seen).toEqual([{ token: 'abc' }]);
  });

  it('requires shared input for every target in a target set', () => {
    const s = setup({
      schemas: { events: { GO: types<{}>() } },
      states: {
        idle: {},
        active: {
          type: 'parallel',
          states: {
            left: {
              type: 'compound',
              initial: 'ready',
              states: {
                ready: { schemas: { input: types<{ leftId: number }>() } }
              }
            },
            right: {
              type: 'compound',
              initial: 'ready',
              states: {
                ready: {
                  schemas: { input: types<{ rightId: boolean }>() }
                }
              }
            }
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: {
              target: ['active.left.ready', 'active.right.ready'],
              input: { leftId: 1, rightId: true }
            }
          }
        },
        active: {
          states: {
            left: {
              initial: { target: 'ready', input: { leftId: 1 } },
              states: {
                ready: {
                  entry: ({ input }) => {
                    input.leftId satisfies number;
                  }
                }
              }
            },
            right: {
              initial: { target: 'ready', input: { rightId: true } },
              states: {
                ready: {
                  entry: ({ input }) => {
                    input.rightId satisfies boolean;
                  }
                }
              }
            }
          }
        }
      }
    });

    s.createStateConfig('idle', {
      on: {
        GO: {
          target: ['active.left.ready', 'active.right.ready'],
          input: { leftId: 1, rightId: true }
        }
      }
    });

    if (false as boolean) {
      s.createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: {
              GO: {
                target: ['active.left.ready', 'active.right.ready'],
                // @ts-expect-error - every target's required input is needed
                input: { leftId: 1 }
              }
            }
          },
          active: {
            states: {
              left: {
                initial: { target: 'ready', input: { leftId: 1 } },
                states: { ready: {} }
              },
              right: {
                initial: { target: 'ready', input: { rightId: true } },
                states: { ready: {} }
              }
            }
          }
        }
      });
    }

    s.createStateConfig('idle', {
      on: {
        GO: {
          target: ['active.left.ready', 'active.right.ready'],
          // @ts-expect-error - every target's required input is needed
          input: { leftId: 1 }
        }
      }
    });

    s.createStateConfig('idle', {
      on: {
        GO: {
          target: ['active.left.ready', 'active.right.ready'],
          // @ts-expect-error - each target input keeps its own field type
          input: { leftId: 1, rightId: 'wrong' }
        }
      }
    });

    if (false) {
      s.createStateConfig('idle', {
        on: {
          GO: {
            target: ['active.left.ready', 'active.right.ready'],
            // @ts-expect-error - input mappers must provide every target field
            input: () => ({ leftId: 1 })
          }
        }
      });

      s.createStateConfig('idle', {
        on: {
          // @ts-expect-error - function results must provide every target field
          GO: () => ({
            target: ['active.left.ready', 'active.right.ready'],
            input: { leftId: 1 }
          })
        }
      });
    }

    const actor = createActor(machine).start();
    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().value).toEqual({
      active: { left: 'ready', right: 'ready' }
    });
  });

  it('passes nested initial inputs through a history default into parallel regions', () => {
    const seen: Array<string | number | boolean> = [];
    const machine = setup({
      schemas: { events: { RESTORE: types<{}>() } },
      states: {
        parent: {
          type: 'compound',
          initial: 'idle',
          states: {
            idle: {},
            active: {
              type: 'parallel',
              states: {
                left: {
                  type: 'compound',
                  initial: 'leaf',
                  states: {
                    leaf: { schemas: { input: types<{ id: number }>() } }
                  }
                },
                right: {
                  type: 'compound',
                  initial: 'leaf',
                  states: {
                    leaf: {
                      schemas: { input: types<{ ready: boolean }>() }
                    }
                  }
                }
              }
            },
            hist: { type: 'history', target: 'active' }
          }
        }
      }
    }).createMachine({
      initial: 'parent',
      states: {
        parent: {
          initial: 'idle',
          states: {
            idle: { on: { RESTORE: { target: 'hist' } } },
            active: {
              states: {
                left: {
                  initial: { target: 'leaf', input: { id: 7 } },
                  states: {
                    leaf: {
                      entry: ({ input }) => {
                        seen.push(input.id);
                      }
                    }
                  }
                },
                right: {
                  initial: { target: 'leaf', input: { ready: true } },
                  states: {
                    leaf: {
                      entry: ({ input }) => {
                        seen.push(input.ready);
                      }
                    }
                  }
                }
              }
            },
            hist: {}
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'RESTORE' });

    expect(actor.getSnapshot().value).toEqual({
      parent: { active: { left: 'leaf', right: 'leaf' } }
    });
    expect(seen).toEqual([7, true]);
  });

  it('carries setup route metadata into the machine event contract', () => {
    const machine = setup({
      states: { home: { id: 'home', route: true } }
    }).createMachine({
      initial: 'home',
      states: { home: {} }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'xstate.route', to: '#home' });

    if (false) {
      actor.send({
        type: 'xstate.route',
        // @ts-expect-error - only setup states with ids and routes are targets
        to: '#missing'
      });
    }

    expect(actor.getSnapshot().value).toBe('home');
  });

  it('uses the authored machine ID when it overrides a setup ID', () => {
    const machine = setup({
      states: { home: { id: 'setup-home', route: true } }
    }).createMachine({
      initial: 'home',
      states: { home: { id: 'machine-home' as const } }
    });

    expect(machine.states.home.id).toBe('machine-home');

    const actor = createActor(machine).start();
    actor.send({ type: 'xstate.route', to: '#machine-home' });

    if (false as boolean) {
      actor.send({
        type: 'xstate.route',
        // @ts-expect-error - the setup ID is overridden by the machine ID
        to: '#setup-home'
      });
    }

    expect(actor.getSnapshot().value).toBe('home');
  });

  it('keeps descendant IDs in strict target contracts when parents have IDs', () => {
    const s = setup({
      schemas: {
        events: {
          TO_LEFT: types<{}>(),
          TO_BOTH: types<{}>()
        }
      },
      states: {
        idle: {},
        active: {
          type: 'parallel',
          id: 'active-state',
          states: {
            left: {
              type: 'compound',
              initial: 'ready',
              states: {
                ready: {
                  id: 'left-ready',
                  schemas: { input: types<{ leftId: number }>() }
                }
              }
            },
            right: {
              type: 'compound',
              initial: 'ready',
              states: {
                ready: {
                  id: 'right-ready',
                  schemas: { input: types<{ rightId: boolean }>() }
                }
              }
            }
          }
        }
      }
    });

    s.createStateConfig('idle', {
      on: {
        TO_LEFT: { target: '#left-ready', input: { leftId: 1 } },
        TO_BOTH: {
          target: ['#left-ready', '#right-ready'],
          input: { leftId: 1, rightId: true }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            TO_LEFT: { target: '#left-ready', input: { leftId: 1 } },
            TO_BOTH: {
              target: ['#left-ready', '#right-ready'],
              input: { leftId: 1, rightId: true }
            }
          }
        },
        active: {
          states: {
            left: {
              initial: { target: 'ready', input: { leftId: 1 } },
              states: { ready: {} }
            },
            right: {
              initial: { target: 'ready', input: { rightId: true } },
              states: { ready: {} }
            }
          }
        }
      }
    });

    if (false as boolean) {
      s.createStateConfig('idle', {
        on: {
          // @ts-expect-error - the descendant ID must be known
          TO_LEFT: { target: '#missing', input: { leftId: 1 } }
        }
      });

      s.createStateConfig('idle', {
        on: {
          // @ts-expect-error - the descendant ID must be known in the target set
          TO_BOTH: {
            target: ['#left-ready', '#missing'],
            input: { leftId: 1, rightId: true }
          }
        }
      });
    }

    expect(machine.states.active.states.left.states.ready.id).toBe(
      'left-ready'
    );
  });

  it('handles a larger explicit parallel topology', () => {
    const s = setup({
      schemas: { events: { NEXT: types<{}>() } },
      states: {
        app: {
          type: 'parallel',
          id: 'workflow',
          states: {
            regionOne: {
              type: 'compound',
              initial: 's1',
              states: {
                s1: {},
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            },
            regionTwo: {
              type: 'compound',
              initial: 's1',
              states: {
                s1: {},
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            },
            regionThree: {
              type: 'compound',
              initial: 's1',
              states: {
                s1: {},
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            },
            regionFour: {
              type: 'compound',
              initial: 's1',
              states: {
                s1: {},
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            },
            regionFive: {
              type: 'compound',
              initial: 's1',
              states: {
                s1: {},
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            },
            regionSix: {
              type: 'compound',
              initial: 's1',
              states: {
                s1: {},
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            }
          }
        }
      }
    });

    const machine = s.createMachine({
      initial: 'app',
      states: {
        app: {
          states: {
            regionOne: {
              states: {
                s1: { on: { NEXT: { target: '#workflow.regionOne.s2' } } },
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            },
            regionTwo: {
              states: {
                s1: { on: { NEXT: { target: 's2' } } },
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            },
            regionThree: {
              states: {
                s1: { on: { NEXT: { target: 's2' } } },
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            },
            regionFour: {
              states: {
                s1: { on: { NEXT: { target: 's2' } } },
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            },
            regionFive: {
              states: {
                s1: { on: { NEXT: { target: 's2' } } },
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            },
            regionSix: {
              states: {
                s1: { on: { NEXT: { target: 's2' } } },
                s2: {},
                s3: {},
                s4: {},
                s5: {},
                s6: {},
                s7: {},
                s8: {}
              }
            }
          }
        }
      }
    });

    expect(machine.states.app.states.regionSix.states.s8).toBeDefined();
  });
});
