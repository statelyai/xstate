/**
 * Serializability conformance (see V6_REVIEW.md §3.4).
 *
 * Machine-as-data is a load-bearing property: machines must be storable,
 * diffable, and revivable as JSON, and the boundary between serializable
 * structure and runtime implementations must be explicit — never silent.
 *
 * Contract:
 *
 * 1. `serializeMachine(machine)` never throws and is JSON-safe.
 * 2. Serializable structure (states, transitions, targets, serialized actions,
 *    guard refs, string actor srcs, delays, meta, context values) survives a
 *    JSON round-trip through `createMachineFromConfig`.
 * 3. Runtime functions appear as code expressions. Actor logic and schemas appear
 *    as `{ $unserializable }` markers — visible, not dropped.
 * 4. A machine created from JSON round-trips losslessly (byte-stable).
 */
import {
  createActor,
  createAsyncLogic,
  createMachine,
  serializeMachine,
  setup,
  types
} from '../src/index.ts';
import { createMachineFromConfig } from '../src/createMachineFromConfig';
import { z } from 'zod';

function findMarkers(json: unknown, path = '$'): string[] {
  if (json === null || typeof json !== 'object') {
    return [];
  }
  if ('$unserializable' in (json as object)) {
    return [path];
  }
  return Object.entries(json as Record<string, unknown>).flatMap(([k, v]) =>
    findMarkers(v, `${path}.${k}`)
  );
}

describe('serializability conformance', () => {
  it('a fully-serializable definition round-trips losslessly', () => {
    const definition = {
      initial: 'idle',
      version: '1.0.0',
      context: { retries: 0 },
      states: {
        idle: {
          on: {
            START: { target: 'running' }
          }
        },
        running: {
          entry: [{ type: '@xstate.raise', event: { type: 'kick' } }],
          invoke: { src: 'worker', onDone: { target: 'done' } },
          on: {
            kick: [
              {
                target: 'done',
                guard: { type: 'canFinish', params: { limit: 3 } }
              }
            ]
          },
          after: {
            1000: { target: 'done' }
          }
        },
        done: { type: 'final', output: { ok: true } }
      }
    };

    const machine = createMachineFromConfig(definition as any);
    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));

    expect(json).toEqual(definition);
    expect(findMarkers(json)).toEqual([]);

    // Revive and serialize again: byte-stable.
    const revived = createMachineFromConfig(json);
    expect(JSON.stringify(serializeMachine(revived))).toBe(
      JSON.stringify(serializeMachine(machine))
    );
  });

  it('JSON.stringify never throws on an inline-authored machine', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({ count: z.number() }),
        events: { INC: z.object({ by: z.number() }) }
      },
      context: { count: 0 },
      actorSources: {},
      actions: {
        track: () => {}
      },
      initial: 'a',
      states: {
        a: {
          on: {
            INC: ({ context, event }) => ({
              context: { count: context.count + event.by }
            })
          }
        }
      }
    });

    expect(() => JSON.stringify(serializeMachine(machine))).not.toThrow();
  });

  it('setup/createMachine implementations serialize named functions to code directives', () => {
    function track() {}
    function isReady() {
      return true;
    }
    function shortDelay() {
      return 10;
    }

    const machine = setup({
      schemas: {
        context: types<{ ok: boolean }>()
      }
    }).createMachine({
      context: { ok: true },
      actions: {
        track
      },
      guards: {
        isReady
      },
      delays: {
        shortDelay
      },
      initial: 'idle',
      states: {
        idle: {
          entry: ({ actions }, enq) => {
            enq(actions.track);
          },
          after: {
            shortDelay: ({ guards }) => {
              if (guards.isReady()) {
                return { target: 'done' };
              }
            }
          }
        },
        done: {}
      }
    });

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));

    expect(json.actions.track).toEqual({
      '@type': 'code',
      lang: 'ts',
      expr: track.toString()
    });
    expect(json.guards.isReady).toEqual({
      '@type': 'code',
      lang: 'ts',
      expr: isReady.toString()
    });
    expect(json.delays.shortDelay).toEqual({
      '@type': 'code',
      lang: 'ts',
      expr: shortDelay.toString()
    });
  });

  it('inline guards/actions serialize to code directives', () => {
    const entry = (_: any) => undefined;
    const guard = ({ context }: any) => context.ok;
    const transition = (args: any, enq: any) => {
      if (guard(args)) {
        enq(entry);
        return { target: 'b' };
      }
    };

    const machine = createMachine({
      context: { ok: true },
      initial: 'a',
      states: {
        a: {
          entry,
          on: {
            GO: transition
          }
        },
        b: {}
      }
    });

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));

    expect(json.states.a.entry).toEqual({
      '@type': 'code',
      lang: 'ts',
      expr: entry.toString()
    });
    expect(json.states.a.on.GO).toEqual({
      '@type': 'code',
      lang: 'ts',
      expr: transition.toString()
    });
  });

  it('actors and schemas surface as explicit $unserializable markers', () => {
    const worker = createAsyncLogic({
      run: async () => undefined
    });
    const machine = createMachine({
      context: { ok: true },
      schemas: {
        context: z.object({ ok: z.boolean() }),
        events: {
          GO: z.object({})
        }
      },
      actorSources: {
        worker
      },
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: worker
          },
          on: {
            GO: { target: 'b' }
          }
        },
        b: {}
      }
    });

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));
    const markers = findMarkers(json);

    expect(markers).toEqual(
      expect.arrayContaining([
        '$.states.a.invoke.src',
        '$.actorSources.worker',
        '$.schemas.context',
        '$.schemas.events.GO'
      ])
    );
    // Structure survives.
    expect(Object.keys(json.states)).toEqual(['a', 'b']);
    expect(json.context).toEqual({ ok: true });
  });

  it('serializable structure survives even when implementations do not', () => {
    const machine = createMachine({
      initial: 'idle',
      internalEvents: ['tick'],
      states: {
        idle: {
          timeout: '5s',
          onTimeout: { target: 'expired' },
          on: { NEXT: { target: 'expired' } }
        },
        expired: { type: 'final' }
      }
    });

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));

    expect(json.initial).toBe('idle');
    expect(json.internalEvents).toEqual(['tick']);
    expect(json.states.idle.timeout).toBe('5s');
    expect(json.states.idle.onTimeout).toEqual({ target: 'expired' });
    expect(json.states.idle.on.NEXT).toEqual({ target: 'expired' });
  });

  it('JSON-safe unknown data is preserved', () => {
    const machine = createMachine({
      initial: 'idle',
      customData: {
        label: 'Portable',
        values: [1, true, null]
      },
      states: {
        idle: {
          'x-viz': {
            x: 10,
            y: 20
          }
        }
      }
    } as any);

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));

    expect(json.customData).toEqual({
      label: 'Portable',
      values: [1, true, null]
    });
    expect(json.states.idle['x-viz']).toEqual({
      x: 10,
      y: 20
    });
  });

  it('revived machines run: structure + provided implementations', () => {
    const definition = JSON.parse(
      JSON.stringify(
        serializeMachine(
          createMachineFromConfig({
            initial: 'inactive',
            states: {
              inactive: { on: { toggle: { target: 'active' } } },
              active: { on: { toggle: { target: 'inactive' } } }
            }
          } as any)
        )
      )
    );

    const machine = createMachineFromConfig(definition);
    const actor = createActor(machine).start();
    actor.send({ type: 'toggle' });
    expect(actor.getSnapshot().value).toBe('active');
  });
});
