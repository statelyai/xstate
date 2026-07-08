import z from 'zod';
import { createActor, setup } from '../src/index.ts';

describe('persisting state input', () => {
  describe('getPersistedSnapshot() output shape', () => {
    it('emits a flat `stateInputs` map keyed by node id across a deep hierarchy, omitting input-less nodes', () => {
      const machine = setup({
        states: {
          level1: {
            schemas: {
              input: z.object({ l1: z.string() })
            },
            states: {
              level2: {
                schemas: {
                  input: z.object({ l2: z.string() })
                },
                states: {
                  level3: {
                    schemas: {
                      input: z.object({ l3: z.string() })
                    },
                    states: {
                      // active but has no input -> must be absent from the map
                      level4: {}
                    }
                  }
                }
              }
            }
          }
        }
      }).createMachine({
        initial: { target: 'level1', input: { l1: 'a' } },
        states: {
          level1: {
            initial: { target: 'level2', input: { l2: 'b' } },
            states: {
              level2: {
                initial: { target: 'level3', input: { l3: 'c' } },
                states: {
                  level3: {
                    initial: 'level4',
                    states: {
                      level4: {}
                    }
                  }
                }
              }
            }
          }
        }
      });

      const actor = createActor(machine).start();
      const persisted = actor.getPersistedSnapshot() as any;

      expect(persisted).toHaveProperty('stateInputs');

      expect(persisted.stateInputs).toEqual({
        '(machine).level1': { l1: 'a' },
        '(machine).level1.level2': { l2: 'b' },
        '(machine).level1.level2.level3': { l3: 'c' }
      });
    });
  });

  describe('round-trip (persist -> restore)', () => {
    it('state input survives persist -> JSON round-trip -> restore', () => {
      // parent input is set by an event, child input by a nested initial
      // transition — both active nodes' inputs must survive the round-trip.
      const machine = setup({
        states: {
          idle: {},
          parent: {
            schemas: {
              input: z.object({ parentId: z.string() })
            },
            states: {
              child: {
                schemas: {
                  input: z.object({ childId: z.number() })
                }
              }
            }
          }
        }
      }).createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: {
              LOAD: { target: 'parent', input: { parentId: 'p1' } }
            }
          },
          parent: {
            initial: { target: 'child', input: { childId: 42 } },
            states: {
              child: {}
            }
          }
        }
      });

      const actor = createActor(machine).start();
      actor.send({ type: 'LOAD' });

      const persisted = JSON.parse(
        JSON.stringify(actor.getPersistedSnapshot())
      );
      actor.stop();

      const restored = createActor(machine, { snapshot: persisted }).start();

      expect(restored.getSnapshot().getInputs()).toMatchObject({
        '(machine).parent': { parentId: 'p1' },
        '(machine).parent.child': { childId: 42 }
      });
    });

    it('invoked child: input is persisted nested under the parent, then restored into the child', () => {
      const child = setup({
        states: {
          idle: {},
          loading: {
            schemas: {
              input: z.object({ childId: z.string() })
            }
          }
        }
      }).createMachine({
        initial: 'idle',
        states: {
          idle: {
            on: {
              GO: { target: 'loading', input: { childId: 'child-1' } }
            }
          },
          loading: {}
        }
      });

      // A persistable invoked child must use a string `src` resolved against
      // `actorSources` — an inline actor cannot be persisted.
      const parent = setup({
        actorSources: { child }
      }).createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: { src: 'child', id: 'myChild' }
          }
        }
      });

      const actor = createActor(parent).start();
      const childActor = actor.getSnapshot().children.myChild!;
      childActor.send({ type: 'GO' });

      expect(childActor.getSnapshot().getInputs()['(machine).loading']).toEqual(
        {
          childId: 'child-1'
        }
      );

      const persisted = JSON.parse(
        JSON.stringify(actor.getPersistedSnapshot())
      );

      // Parent state has no input of its own -> no top-level map.
      expect(persisted.stateInputs).toBeUndefined();
      // Child input is persisted nested inside the child's own snapshot.
      expect(persisted.children.myChild.snapshot.stateInputs).toEqual({
        '(machine).loading': { childId: 'child-1' }
      });

      actor.stop();

      const restored = createActor(parent, { snapshot: persisted }).start();
      const restoredChild = restored.getSnapshot().children.myChild!;

      expect(
        restoredChild.getSnapshot().getInputs()['(machine).loading']
      ).toEqual({ childId: 'child-1' });
    });
  });
});
