import { createActor, setup } from '../src/index.ts';
import { mapState } from '../src/mapState.ts';

describe('mapState', () => {
  it('should map context from root state', () => {
    const machine = setup({
      types: {
        context: {} as { count: number }
      }
    }).createMachine({
      context: { count: 42 },
      initial: 'a',
      states: {
        a: {}
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    const results = mapState(snapshot, {
      map: ({ context }) => context.count
    });

    expect(results.map((r) => r.result)).toContain(42);
  });

  it('should map context from nested states', () => {
    const machine = setup({
      types: {
        context: {} as { value: string }
      }
    }).createMachine({
      context: { value: 'test' },
      initial: 'a',
      states: {
        a: {
          initial: 'one',
          states: {
            one: {},
            two: {}
          }
        }
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    const results = mapState(snapshot, {
      map: ({ context }) => `root:${context.value}`,
      states: {
        a: {
          map: ({ context }) => `a:${context.value}`,
          states: {
            one: {
              map: ({ context }) => `one:${context.value}`
            }
          }
        }
      }
    });

    const mapped = results.map((r) => r.result);
    expect(mapped).toContain('root:test');
    expect(results.find((r) => r.stateNode.key === '(machine)')?.result).toBe(
      'root:test'
    );
    expect(results.find((r) => r.stateNode.key === 'a')?.result).toBe('a:test');
    expect(results.find((r) => r.stateNode.key === 'one')?.result).toBe(
      'one:test'
    );
  });

  it('should only call mappers for active states', () => {
    const machine = setup({
      types: {
        context: {} as { x: number }
      }
    }).createMachine({
      context: { x: 1 },
      initial: 'a',
      states: {
        a: {},
        b: {}
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    const results = mapState(snapshot, {
      map: () => 'root',
      states: {
        a: {
          map: () => 'a'
        },
        b: {
          map: () => 'b'
        }
      }
    });

    const mapped = results.map((r) => r.result);
    expect(mapped).toContain('root');
    expect(mapped).toContain('a');
    expect(mapped).not.toContain('b');
  });

  it('should work with parallel states', () => {
    const machine = setup({
      types: {
        context: {} as { val: number }
      }
    }).createMachine({
      context: { val: 100 },
      type: 'parallel',
      states: {
        region1: {
          initial: 'x',
          states: {
            x: {},
            y: {}
          }
        },
        region2: {
          initial: 'p',
          states: {
            p: {},
            q: {}
          }
        }
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    const results = mapState(snapshot, {
      map: () => 'root',
      states: {
        region1: {
          map: () => 'region1',
          states: {
            x: {
              map: () => 'x'
            }
          }
        },
        region2: {
          map: () => 'region2',
          states: {
            p: {
              map: () => 'p'
            }
          }
        }
      }
    });

    const mapped = results.map((r) => r.result);
    expect(mapped).toContain('root');
    expect(mapped).toContain('region1');
    expect(mapped).toContain('x');
    expect(mapped).toContain('region2');
    expect(mapped).toContain('p');
  });

  it('should handle states without mappers', () => {
    const machine = setup({
      types: {
        context: {} as { n: number }
      }
    }).createMachine({
      context: { n: 5 },
      initial: 'a',
      states: {
        a: {
          initial: 'one',
          states: {
            one: {}
          }
        }
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    const results = mapState(snapshot, {
      map: () => 'root',
      states: {
        a: {
          map: () => 'a',
          states: {
            one: {
              map: () => 'one'
            }
          }
        }
      }
    });

    const mapped = results.map((r) => r.result);
    expect(mapped).toContain('root');
    expect(mapped).toContain('a');
    expect(mapped).toContain('one');
    expect(results).toHaveLength(3);
  });

  it('should work with final states', () => {
    const machine = setup({}).createMachine({
      initial: 'active',
      states: {
        active: {
          on: { DONE: 'finished' }
        },
        finished: {
          type: 'final'
        }
      }
    });

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: 'DONE' });
    const snapshot = actor.getSnapshot();

    const results = mapState(snapshot, {
      map: () => 'root',
      states: {
        finished: {
          map: () => 'finished'
        }
      }
    });

    const mapped = results.map((r) => r.result);
    expect(mapped).toContain('root');
    expect(mapped).toContain('finished');
  });

  it('should include stateNode in results', () => {
    const machine = setup({}).createMachine({
      initial: 'a',
      states: {
        a: {
          initial: 'one',
          states: {
            one: {}
          }
        }
      }
    });

    const snapshot = createActor(machine).getSnapshot();

    const results = mapState(snapshot, {
      map: () => 'root',
      states: {
        a: {
          map: () => 'a',
          states: {
            one: {
              map: () => 'one'
            }
          }
        }
      }
    });

    expect(results[0].stateNode.key).toBe('one');
    expect(results[0].result).toBe('one');
    expect(results[1].stateNode.key).toBe('a');
    expect(results[1].result).toBe('a');
    expect(results[2].stateNode.path).toEqual([]);
    expect(results[2].result).toBe('root');
  });

  describe('type safety', () => {
    it('should accept valid state keys', () => {
      const machine = setup({
        types: {
          context: {} as { foo: string }
        }
      }).createMachine({
        context: { foo: 'bar' },
        initial: 'idle',
        states: {
          idle: {},
          loading: {},
          success: {}
        }
      });

      const snapshot = createActor(machine).getSnapshot();

      // This should compile without errors
      mapState(snapshot, {
        map: ({ context }) => context.foo,
        states: {
          idle: {
            map: ({ context }) => context.foo
          },
          loading: {
            map: ({ context }) => context.foo
          },
          success: {
            map: ({ context }) => context.foo
          }
        }
      });
    });

    it('should error on invalid state keys', () => {
      const machine = setup({
        types: {
          context: {} as { foo: string }
        }
      }).createMachine({
        context: { foo: 'bar' },
        initial: 'idle',
        states: {
          idle: {},
          loading: {}
        }
      });

      const snapshot = createActor(machine).getSnapshot();

      mapState(snapshot, {
        map: ({ context }) => context.foo,
        states: {
          idle: {
            map: ({ context }) => context.foo
          },
          // @ts-expect-error - 'nonexistent' is not a valid state key
          nonexistent: {
            map: (_snapshot: any) => _snapshot.context.foo
          }
        }
      });
    });

    it('should error on invalid nested state keys', () => {
      const machine = setup({
        types: {
          context: {} as { val: number }
        }
      }).createMachine({
        context: { val: 0 },
        initial: 'parent',
        states: {
          parent: {
            initial: 'child1',
            states: {
              child1: {},
              child2: {}
            }
          }
        }
      });

      const snapshot = createActor(machine).getSnapshot();

      mapState(snapshot, {
        map: ({ context }) => context.val,
        states: {
          parent: {
            map: ({ context }) => context.val,
            states: {
              child1: {
                map: ({ context }) => context.val
              },
              // @ts-expect-error - 'invalidChild' is not a valid nested state key
              invalidChild: {
                map: (_snapshot: any) => _snapshot.context.val
              }
            }
          }
        }
      });
    });

    it('should infer snapshot type in map function', () => {
      const machine = setup({
        types: {
          context: {} as { count: number; name: string }
        }
      }).createMachine({
        context: { count: 0, name: 'test' },
        initial: 'idle',
        states: {
          idle: {}
        }
      });

      const snapshot = createActor(machine).getSnapshot();

      mapState(snapshot, {
        map: ({ context }) => {
          // These should all be valid
          const n: number = context.count;
          const s: string = context.name;
          return { n, s };
        }
      });
    });
  });
});
