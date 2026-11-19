import { setup, types } from '../src/index.ts';

it('requires ancestor context when targeting descendants', () => {
  setup({
    schemas: {
      context: types<{ id: string | null }>(),
      events: {
        GO: types<{}>(),
        MISSING: types<{}>(),
        ID: types<{}>(),
        ID_MISSING: types<{}>(),
        VALID: types<{}>(),
        VALID_ID: types<{}>(),
        VALID_PARENT: types<{}>(),
        PARENT: types<{}>()
      }
    },
    states: {
      idle: { schemas: { context: types<{ id: null }>() } },
      active: {
        schemas: { context: types<{ id: string }>() },
        states: { running: { id: 'runningId' } }
      }
    }
  }).createMachine({
    context: { id: null },
    initial: 'idle',
    states: {
      idle: {
        on: {
          // @ts-expect-error parent requires string
          PARENT: () => ({ target: 'active', context: { id: null } }),
          // @ts-expect-error descendant inherits string requirement
          GO: () => ({ target: 'active.running', context: { id: null } }),
          // @ts-expect-error descendant requires patch
          MISSING: () => ({ target: 'active.running' }),
          // @ts-expect-error declared id inherits ancestor requirement
          ID: () => ({ target: '#runningId', context: { id: null } }),
          // @ts-expect-error declared id requires patch
          ID_MISSING: () => ({ target: '#runningId' }),
          VALID: () => ({ target: 'active.running', context: { id: 'ok' } }),
          VALID_ID: () => ({ target: '#runningId', context: { id: 'ok' } }),
          VALID_PARENT: () => ({ target: 'active', context: { id: 'ok' } })
        }
      },
      active: {
        on: {
          // @ts-expect-error relative descendants retain the source ancestor refinement
          GO: () => ({ target: '.running', context: { id: null } }),
          MISSING: () => ({ target: '.running' })
        },
        initial: 'running',
        states: {
          running: {
            id: 'runningId',
            on: { GO: () => ({ target: '#runningId' }) }
          }
        }
      }
    }
  });
});

it('retains enclosing context for sibling-relative descendant targets', () => {
  const s = setup({
    schemas: {
      context: types<{ id: string | null }>(),
      events: { INVALID: types<{}>(), VALID: types<{}>(), LEAVE: types<{}>() }
    },
    states: {
      outer: {
        schemas: { context: types<{ id: string }>() },
        states: { source: {}, branch: { states: { leaf: {} } } }
      },
      outside: { id: 'outside' }
    }
  });
  s.createMachine({
    context: { id: 'ok' },
    initial: 'outer',
    states: {
      outer: {
        initial: 'source',
        states: {
          source: {
            on: {
              // @ts-expect-error outer remains active and requires a string
              INVALID: () => ({ target: 'branch.leaf', context: { id: null } }),
              VALID: () => ({ target: 'branch.leaf', context: { id: 'ok' } }),
              LEAVE: () => ({ target: '#outside', context: { id: null } })
            }
          },
          branch: { initial: 'leaf', states: { leaf: {} } }
        }
      },
      outside: { id: 'outside' }
    }
  });
  s.createStateConfig('outer.source', {
    on: {
      // @ts-expect-error extracted state configs retain their enclosing refinement
      INVALID: () => ({ target: 'branch.leaf', context: { id: null } }),
      VALID: () => ({ target: 'branch.leaf', context: { id: 'ok' } }),
      LEAVE: () => ({ target: '#outside', context: { id: null } })
    }
  });
  s.createStateConfig('outer.source', {
    on: {
      INVALID: {
        target: ['branch.leaf'],
        // @ts-expect-error the enclosing refinement is retained
        context: { id: null }
      },
      VALID: { target: ['branch.leaf'], context: { id: 'ok' } },
      LEAVE: { target: ['#outside'], context: { id: null } }
    }
  });
});

it('checks refinements for array targets', () => {
  const s = setup({
    schemas: {
      context: types<{ id: string | null }>(),
      events: { GO: types<{}>(), BAD: types<{}>(), VALID: types<{}>() }
    },
    states: {
      idle: {},
      active: {
        schemas: { context: types<{ id: string }>() },
        states: { running: {} }
      }
    }
  });
  s.createMachine({
    context: { id: null },
    initial: 'idle',
    states: {
      idle: {
        on: {
          // @ts-expect-error array descendant requires an id patch
          GO: { target: ['active.running'] }
        }
      },
      active: { initial: 'running', states: { running: {} } }
    }
  });
  s.createMachine({
    context: { id: null },
    initial: 'idle',
    states: {
      idle: {
        on: {
          // @ts-expect-error array descendant rejects incompatible patches
          BAD: { target: ['active.running'], context: { id: null } }
        }
      },
      active: { initial: 'running', states: { running: {} } }
    }
  });
  s.createMachine({
    context: { id: null },
    initial: 'idle',
    states: {
      idle: {
        on: { VALID: { target: ['active.running'], context: { id: 'ok' } } }
      },
      active: { initial: 'running', states: { running: {} } }
    }
  });
});

it('combines context requirements across parallel target arrays', () => {
  const s = setup({
    schemas: {
      context: types<{ id: string | null; count: number | null }>(),
      events: { GO: types<{}>() }
    },
    states: {
      idle: {},
      active: {
        type: 'parallel',
        states: {
          left: {
            schemas: { context: types<{ id: string }>() },
            states: { leaf: {} }
          },
          right: {
            schemas: { context: types<{ count: number }>() },
            states: { leaf: {} }
          }
        }
      }
    }
  });
  s.createMachine({
    context: { id: null, count: null },
    initial: 'idle',
    states: {
      idle: {
        on: {
          GO: {
            target: ['active.left.leaf', 'active.right.leaf'],
            // @ts-expect-error both regions require compatible context
            context: { id: 'ok' }
          }
        }
      },
      active: {
        type: 'parallel',
        states: {
          left: { initial: 'leaf', states: { leaf: {} } },
          right: { initial: 'leaf', states: { leaf: {} } }
        }
      }
    }
  });
  s.createMachine({
    context: { id: null, count: null },
    initial: 'idle',
    states: {
      idle: {
        on: {
          GO: {
            target: ['active.left.leaf', 'active.right.leaf'],
            context: () => ({ id: 'ok', count: 1 })
          }
        }
      },
      active: {
        type: 'parallel',
        states: {
          left: { initial: 'leaf', states: { leaf: {} } },
          right: { initial: 'leaf', states: { leaf: {} } }
        }
      }
    }
  });
});

it('allows array targets when root context already satisfies the refinement', () => {
  setup({
    schemas: { context: types<{ id: string }>(), events: { GO: types<{}>() } },
    states: {
      idle: {},
      active: {
        schemas: { context: types<{ id: string }>() },
        states: { running: {} }
      }
    }
  }).createMachine({
    context: { id: 'ok' },
    initial: 'idle',
    states: {
      idle: { on: { GO: { target: ['active.running'] } } },
      active: { initial: 'running', states: { running: {} } }
    }
  });
});

it('preserves union root context for unrefined array targets', () => {
  setup({
    schemas: {
      context: types<{ kind: 'a'; a: string } | { kind: 'b'; b: number }>(),
      events: { GO: types<{}>() }
    },
    states: { idle: {}, done: {} }
  }).createMachine({
    context: { kind: 'a', a: '' },
    initial: 'idle',
    states: { idle: { on: { GO: { target: ['done'] } } }, done: {} }
  });
});
