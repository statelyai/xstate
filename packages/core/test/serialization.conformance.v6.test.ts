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
 * 3. Runtime implementations (inline functions, actor logic, schemas) appear as `{
 *    $unserializable }` markers — visible, not dropped.
 * 4. A machine created from JSON round-trips losslessly (byte-stable).
 */
import { createActor, createMachine, serializeMachine } from '../src/index.ts';
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
      actors: {},
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

  it('inline implementations surface as explicit $unserializable markers', () => {
    const machine = createMachine({
      context: { ok: true },
      actions: {
        log: (() => {}) as any
      },
      guards: {
        isOk: ({ context }: any) => context.ok
      },
      initial: 'a',
      states: {
        a: {
          entry: (_: any) => undefined,
          on: {
            GO: () => ({ target: 'b' })
          }
        },
        b: {}
      }
    });

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));
    const markers = findMarkers(json);

    // The inline transition, entry action, and named implementations are
    // marked — visible in the data, not silently dropped.
    expect(markers).toEqual(
      expect.arrayContaining([
        '$.states.a.entry',
        '$.states.a.on.GO',
        '$.actions.log',
        '$.guards.isOk'
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
      triggers: [{ type: 'webhook', path: '/hook' }],
      states: {
        idle: {
          timeout: '5s',
          onTimeout: 'expired',
          on: { NEXT: 'expired' }
        },
        expired: { type: 'final' }
      }
    });

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));

    expect(json.initial).toBe('idle');
    expect(json.internalEvents).toEqual(['tick']);
    expect(json.triggers).toEqual([{ type: 'webhook', path: '/hook' }]);
    expect(json.states.idle.timeout).toBe('5s');
    expect(json.states.idle.onTimeout).toBe('expired');
    expect(json.states.idle.on.NEXT).toBe('expired');
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
