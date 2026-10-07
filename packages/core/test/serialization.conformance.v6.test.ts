/**
 * Serializability conformance (see V6_REVIEW.md §3.4).
 *
 * Machine-as-data is a load-bearing property: machines must be storable,
 * diffable, and revivable as JSON, and the boundary between serializable
 * structure and runtime sources must be explicit — never silent.
 *
 * Contract:
 *
 * 1. `serializeMachine(machine)` never throws and is JSON-safe.
 * 2. Serializable structure (states, transitions, targets, serialized actions,
 *    guard refs, string actor srcs, delays, meta, context values) survives a
 *    JSON round-trip through `createMachineFromConfig`.
 * 3. Inline runtime functions appear as code expressions. Root source maps, actor
 *    logic, and runtime schemas are omitted.
 * 4. A machine created from JSON round-trips losslessly (byte-stable).
 */
import {
  _createMachineFromCompiledConfig,
  createActor,
  createAsyncLogic,
  createMachine,
  type AnyStateMachine,
  type MachineInspectionJSON,
  type MachineSerializationOptions,
  type EventRejection,
  serializeMachine,
  setup,
  types
} from '../src/index.ts';
import { createMachineFromConfig } from '../src/createMachineFromConfig';
import { z } from 'zod';

function findCodeExpressions(json: unknown, path = '$'): string[] {
  if (json === null || typeof json !== 'object') {
    return [];
  }
  if ('@code' in (json as object)) {
    return [path];
  }
  return Object.entries(json as Record<string, unknown>).flatMap(([k, v]) =>
    findCodeExpressions(v, `${path}.${k}`)
  );
}

describe('serializability conformance', () => {
  it('serialization modes retain precise output types', () => {
    const machine = createMachine({});
    expectTypeOf(machine.serialize()).toEqualTypeOf<Record<string, unknown>>();
    expectTypeOf(
      machine.serialize({ mode: 'inspection' })
    ).toEqualTypeOf<MachineInspectionJSON>();
    expectTypeOf(
      serializeMachine(machine, { mode: 'inspection' })
    ).toEqualTypeOf<MachineInspectionJSON>();
    function serializeWithOptions(options?: MachineSerializationOptions) {
      return machine.serialize(options);
    }
    expectTypeOf(serializeWithOptions()).toEqualTypeOf<
      Record<string, unknown> | MachineInspectionJSON
    >();
  });

  it('public hooks preserve original JSON, including after provide()', () => {
    const definition = {
      initial: 'idle',
      states: { idle: { on: { GO: { target: 'done' } } }, done: {} }
    };
    const machine = createMachineFromConfig(definition);
    for (const logic of [machine, machine.provide({})]) {
      expect(logic.serialize()).toEqual(definition);
      expect(logic.serialize()).toEqual(serializeMachine(logic));
      expect(logic.serialize({ mode: 'inspection' })).toEqual({
        format: 'xstate-inspection',
        formatVersion: 1,
        profile: 'xstate-v6',
        definition
      });
      expect(logic.serialize({ mode: 'inspection' }).definition).toEqual(
        definition
      );
      expect(createMachineFromConfig(logic.serialize()).serialize()).toEqual(
        definition
      );
    }
  });

  it('both public serialization modes isolate revived machine definitions', () => {
    const definition = {
      initial: 'idle',
      context: { count: 1 },
      states: { idle: { tags: ['original'] } }
    };
    const machine = createMachineFromConfig(definition);
    const provided = machine.provide({});
    definition.context.count = 99;
    definition.states.idle.tags.push('input mutation');
    for (const logic of [machine, provided]) {
      const canonical = logic.serialize() as typeof definition;
      const inspected = logic.serialize({ mode: 'inspection' })
        .definition as typeof definition;
      expect(canonical.context.count).toBe(1);
      expect(inspected.states.idle.tags).toEqual(['original']);
      canonical.context.count = 100;
      inspected.states.idle.tags.push('output mutation');
      expect(logic.serialize().context).toEqual({ count: 1 });
      expect(logic.serialize({ mode: 'inspection' }).definition.states).toEqual(
        { idle: { tags: ['original'] } }
      );
    }
    expect(createActor(machine).getSnapshot().context).toEqual({ count: 1 });
  });

  it('public serialization captures inline handlers without runtime sources', () => {
    const go = () => ({ target: 'done' as const });
    const machine = createMachine({
      actions: { unused: () => {} },
      initial: 'idle',
      states: { idle: { on: { GO: go } }, done: {} }
    });
    expect(machine.serialize()).toEqual(serializeMachine(machine));
    expect(machine.serialize({ mode: 'definition' })).toEqual(
      machine.serialize()
    );
    expect(serializeMachine(machine, { mode: 'definition' })).toEqual(
      machine.serialize()
    );
    const json = JSON.parse(JSON.stringify(machine.serialize()));
    expect(json.states.idle.on.GO).toEqual({
      '@code': go.toString(),
      '@lang': 'ts'
    });
    expect(json.actions).toBeUndefined();
  });

  it('inspection retains inline invoke topology without making actors portable', () => {
    const worker = createAsyncLogic({ run: async () => undefined });
    const done = () => ({ target: 'done' as const });
    const error = () => ({ target: 'failed' as const });
    const snapshot = () => ({ target: 'observed' as const });
    const machine = createMachine({
      actors: { named: worker },
      initial: 'running',
      states: {
        running: {
          invoke: [
            {
              id: 'anonymous-worker',
              src: worker,
              onDone: done,
              onError: error,
              onSnapshot: snapshot,
              timeout: 100,
              onTimeout: error
            },
            { src: 'named', onDone: done }
          ],
          states: {
            nested: { invoke: { src: worker, onDone: () => ({}) } }
          },
          initial: 'nested'
        },
        done: {},
        failed: {},
        observed: {}
      }
    });
    const inspection = JSON.parse(
      JSON.stringify(machine.serialize({ mode: 'inspection' }))
    );
    expect(machine.serialize({ mode: 'inspection' })).toEqual(
      serializeMachine(machine, { mode: 'inspection' })
    );
    const running = inspection.definition.states.running;
    expect(running.invoke).toEqual([
      {
        id: 'anonymous-worker',
        src: { '@actor': 'inline' },
        onDone: { '@code': done.toString(), '@lang': 'ts' },
        onError: { '@code': error.toString(), '@lang': 'ts' },
        onSnapshot: { '@code': snapshot.toString(), '@lang': 'ts' },
        timeout: 100,
        onTimeout: { '@code': error.toString(), '@lang': 'ts' }
      },
      {
        src: 'named',
        onDone: { '@code': done.toString(), '@lang': 'ts' }
      }
    ]);
    expect(running.states.nested.invoke.src).toEqual({ '@actor': 'inline' });
    expect(inspection.definition.actors).toBeUndefined();
    expect((machine.serialize().states as any).running.invoke).toEqual([
      { src: 'named', onDone: { '@code': done.toString(), '@lang': 'ts' } }
    ]);
    expect(
      (machine.serialize().states as any).running.states.nested.invoke
    ).toBeUndefined();
    expect(() => createMachineFromConfig(inspection)).toThrow(
      'Inspection envelopes are not executable'
    );
    expect(() => createMachineFromConfig(inspection.definition)).toThrow(
      'inspection placeholders are not executable'
    );
  });

  it('named inline machine sources retain executable roundtrip semantics', () => {
    const child = createMachine({
      id: 'child',
      initial: 'idle',
      states: { idle: {} }
    });
    const machine = createMachine({
      initial: 'idle',
      states: { idle: { invoke: { id: 'child-ref', src: child } } }
    });
    const json = JSON.parse(JSON.stringify(machine.serialize()));
    expect(json.states.idle.invoke.src).toBe('child');
    expect(machine.serialize({ mode: 'inspection' }).definition).toEqual(json);
    const revived = createMachineFromConfig(json, { actors: { child } });
    expect(revived.serialize()).toEqual(json);
    expect(
      createActor(revived).getSnapshot().children['child-ref'].getSnapshot()
        .value
    ).toBe('idle');
  });

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

    const sources = {
      actors: {
        worker: createAsyncLogic({
          run: async () => undefined
        })
      },
      guards: {
        canFinish: () => true
      }
    };
    const machine = createMachineFromConfig(definition as any, sources);
    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));

    expect(json).toEqual(definition);
    expect(findCodeExpressions(json)).toEqual([]);

    // Revive and serialize again: byte-stable.
    const revived = createMachineFromConfig(json, sources);
    expect(JSON.stringify(serializeMachine(revived))).toBe(
      JSON.stringify(serializeMachine(machine))
    );
  });

  it('a machine created from JSON does not share its definition', () => {
    const definition = {
      id: 'counter',
      context: { count: 0 },
      actions: {
        bump: { type: '@xstate.assign', context: { count: 1 } }
      },
      initial: 'idle',
      states: {
        idle: {
          meta: { label: 'Idle' },
          on: { inc: { actions: [{ type: 'bump' }] } }
        }
      }
    };
    const original = JSON.parse(JSON.stringify(definition));
    const machine = createMachineFromConfig(definition as any);
    const json = serializeMachine(machine) as any;

    expect(json).toEqual(original);
    expect(json).not.toBe(definition);

    // neither the caller's definition nor the serialized copy reaches the
    // running machine
    definition.context.count = 10;
    json.context.count = 42;
    json.actions.bump.context.count = 7;
    json.states.idle.meta.label = 'Edited';

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().context).toEqual({ count: 0 });
    expect(actor.getSnapshot().getMeta()).toEqual({
      'counter.idle': { label: 'Idle' }
    });
    actor.send({ type: 'inc' });
    expect(actor.getSnapshot().context).toEqual({ count: 1 });
    expect(serializeMachine(machine)).toEqual(original);
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

  it('setup/createMachine root sources are omitted', () => {
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

    expect(json.actions).toBeUndefined();
    expect(json.guards).toBeUndefined();
    expect(json.delays).toBeUndefined();
    expect(json.states.idle).toMatchInlineSnapshot(`
      {
        "after": {
          "shortDelay": {
            "@code": "({ guards }) => {
                    if (guards.isReady()) {
                      return { target: "done" };
                    }
                  }",
            "@lang": "ts",
          },
        },
        "entry": {
          "@code": "({ actions }, enq) => {
                  enq(actions.track);
                }",
          "@lang": "ts",
        },
      }
    `);
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

    expect(json.states.a).toMatchInlineSnapshot(`
      {
        "entry": {
          "@code": "(_) => void 0",
          "@lang": "ts",
        },
        "on": {
          "GO": {
            "@code": "(args, enq) => {
            if (guard(args)) {
              enq(entry);
              return { target: "b" };
            }
          }",
            "@lang": "ts",
          },
        },
      }
    `);
  });

  it('actors and schemas are omitted instead of marked', () => {
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
      actors: {
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

    expect(findCodeExpressions(json)).toEqual([]);
    expect(json.actors).toBeUndefined();
    expect(json.schemas.context).toBeUndefined();
    expect(json.schemas.events.GO).toBeUndefined();
    expect(json.states.a.invoke).toBeUndefined();
    // Structure survives.
    expect(json).toMatchInlineSnapshot(`
      {
        "context": {
          "ok": true,
        },
        "initial": "a",
        "schemas": {
          "events": {},
        },
        "states": {
          "a": {
            "on": {
              "GO": {
                "target": "b",
              },
            },
          },
          "b": {},
        },
      }
    `);
  });

  it('drops nonportable values from objects and arrays', () => {
    const machine = createMachine({
      context: {
        kept: 'value',
        dropped: new Date(0),
        list: ['a', new Date(0), 'b']
      },
      initial: 'idle',
      states: {
        idle: {}
      }
    } as any);

    const directJSON = serializeMachine(machine);
    const json = JSON.parse(JSON.stringify(directJSON));

    expect((directJSON as any).context.dropped).toBeUndefined();
    expect((directJSON as any).context).not.toHaveProperty('dropped');
    expect(json).toMatchInlineSnapshot(`
      {
        "context": {
          "kept": "value",
          "list": [
            "a",
            "b",
          ],
        },
        "initial": "idle",
        "states": {
          "idle": {},
        },
      }
    `);
  });

  it('serializable structure survives even when sources do not', () => {
    const machine = createMachine({
      initial: 'idle',
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

    expect(json).toMatchInlineSnapshot(`
      {
        "initial": "idle",
        "states": {
          "expired": {
            "type": "final",
          },
          "idle": {
            "on": {
              "NEXT": {
                "target": "expired",
              },
            },
            "onTimeout": {
              "target": "expired",
            },
            "timeout": "5s",
          },
        },
      }
    `);
  });

  it('internal event names survive and stay internal after revival', () => {
    const machine = createMachine({
      schemas: {
        internalEvents: { tick: types<{}>() }
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            start: { target: 'raising' },
            tick: { target: 'failed' }
          }
        },
        raising: {
          entry: (_, enq) => {
            enq.raise({ type: 'tick' });
          },
          on: { tick: { target: 'done' } }
        },
        done: {},
        failed: {}
      }
    });

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));
    expect(json.internalEvents).toEqual(['tick']);

    const revived = createMachineFromConfig(json, {
      evaluators: {
        ts: ({ source, scope }: any) =>
          Function(`return (${source});`)()(scope, scope.enq)
      }
    });
    expect(serializeMachine(revived)).toEqual(json);

    // a stray top-level `internalEvents` config key (removed author API) is
    // not serialized
    const stray = _createMachineFromCompiledConfig({
      internalEvents: ['stray'],
      schemas: { internalEvents: { tick: types<{}>() } },
      initial: 'idle',
      states: { idle: {} }
    });
    expect(serializeMachine(stray).internalEvents).toEqual(['tick']);
    expect(
      serializeMachine(
        _createMachineFromCompiledConfig({
          internalEvents: ['stray'],
          initial: 'idle',
          states: { idle: {} }
        })
      )
    ).not.toHaveProperty('internalEvents');

    for (const logic of [machine, revived] as AnyStateMachine[]) {
      const rejections: EventRejection[] = [];
      const actor = createActor(logic, {
        onRejectedEvent: (rejection) => rejections.push(rejection)
      }).start();

      // external senders are rejected
      actor.send({ type: 'tick' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(rejections.map((r) => [r.event.type, r.reason])).toEqual([
        ['tick', 'internalEvent']
      ]);

      // raised internal events are accepted
      actor.send({ type: 'start' });
      expect(actor.getSnapshot().value).toBe('done');
      expect(rejections).toHaveLength(1);
    }
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

    expect(json).toMatchInlineSnapshot(`
      {
        "customData": {
          "label": "Portable",
          "values": [
            1,
            true,
            null,
          ],
        },
        "initial": "idle",
        "states": {
          "idle": {
            "x-viz": {
              "x": 10,
              "y": 20,
            },
          },
        },
      }
    `);
  });

  it('revived machines run: structure + provided sources', () => {
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

it('preserves constructor and __proto__ JSON keys without sharing context', () => {
  const definition = JSON.parse(
    '{"context":{"constructor":"value","__proto__":{"count":1}}}'
  );
  const machine = createMachineFromConfig(definition);
  const serialized = serializeMachine(machine);
  expect(serialized).toEqual(definition);
  expect(Object.getPrototypeOf(serialized.context)).toBe(Object.prototype);
  (serialized.context as any).__proto__.count = 2;
  expect(serializeMachine(machine)).toEqual(definition);
});
