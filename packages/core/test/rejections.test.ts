import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  createActor,
  createMachine,
  machineFromJSON,
  machineToJSON,
  setup,
  types,
  type RejectionFrom
} from '../src/index.ts';
import { z } from 'zod';
import { standardSchemaValidator } from '../src/validation/index.ts';

describe('transition rejection', () => {
  it('checks typed rejection reasons and consumes the event before parent fallback', () => {
    const parent = vi.fn();
    const machine = createMachine({
      schemas: {
        events: { submit: types<void>() },
        rejections: {
          'email.required': types<void>(),
          'balance.insufficient': types<{
            available: number;
            required: number;
          }>()
        }
      },
      id: 'checkout',
      initial: 'editing',
      on: { submit: (_, enq) => enq(parent) },
      states: {
        editing: {
          on: {
            submit: ({ reject }) =>
              reject([
                { type: 'email.required' },
                { type: 'balance.insufficient', available: 20, required: 50 }
              ])
          }
        }
      }
    });
    const actor = createActor(machine).start();
    const snapshot = actor.getSnapshot();
    expect(snapshot.check({ type: 'submit' })).toEqual({
      status: 'rejected',
      rejections: [
        {
          source: 'checkout.editing',
          reasons: [
            { type: 'email.required' },
            { type: 'balance.insufficient', available: 20, required: 50 }
          ]
        }
      ]
    });
    expect(snapshot.can({ type: 'submit' })).toBe(false);
    actor.send({ type: 'submit' });
    expect(actor.getSnapshot().value).toBe('editing');
    expect(parent).not.toHaveBeenCalled();
    const result = snapshot.check({ type: 'submit' });
    if (result.status === 'rejected' || result.status === 'partial') {
      for (const reason of result.rejections[0].reasons) {
        if (reason.type === 'balance.insufficient') {
          expectTypeOf(reason.available).toEqualTypeOf<number>();
        }
      }
    }
    expectTypeOf<RejectionFrom<typeof machine>>().toMatchTypeOf<
      | { type: 'email.required' }
      | { type: 'balance.insufficient'; available: number; required: number }
    >();
    actor.stop();
  });

  it('continues parent fallback when a handler returns undefined', () => {
    const machine = createMachine({
      initial: 'editing',
      on: { submit: { target: '.submitted' } },
      states: { editing: { on: { submit: () => undefined } }, submitted: {} }
    });
    const actor = createActor(machine).start();
    expect(actor.getSnapshot().check({ type: 'submit' }).status).toBe(
      'accepted'
    );
    actor.send({ type: 'submit' });
    expect(actor.getSnapshot().value).toBe('submitted');
    actor.stop();
  });

  it('accepts a selected targetless handler with no effects', () => {
    const machine = createMachine({ on: { go: () => ({}) } });
    const actor = createActor(machine).start();
    expect(actor.getSnapshot().check({ type: 'go' })).toEqual({
      status: 'accepted'
    });
    expect(actor.getSnapshot().can({ type: 'go' })).toBe(true);
    actor.stop();
  });

  it('reports partial acceptance and executes only accepting regions', () => {
    const effect = vi.fn();
    const machine = createMachine({
      id: 'parallel',
      schemas: { rejections: { blocked: types<void>() } },
      type: 'parallel',
      states: {
        payment: {
          on: { submit: ({ reject }) => reject([{ type: 'blocked' }]) }
        },
        activity: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                submit: (_, enq) => {
                  enq(effect);
                  return { target: 'recorded' };
                }
              }
            },
            recorded: {}
          }
        },
        unrelated: {}
      }
    });
    const actor = createActor(machine).start();
    const snapshot = actor.getSnapshot();
    expect(snapshot.check({ type: 'submit' })).toEqual({
      status: 'partial',
      rejections: [
        { source: 'parallel.payment', reasons: [{ type: 'blocked' }] }
      ]
    });
    expect(snapshot.can({ type: 'submit' })).toBe(true);
    expect(effect).not.toHaveBeenCalled();
    actor.send({ type: 'submit' });
    expect(effect).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().matches({ activity: 'recorded' })).toBe(true);
    actor.stop();
  });

  it('rejects invalid names, payloads, and empty arrays at compile time', () => {
    const machine = setup({
      schemas: { rejections: { blocked: types<{ count: number }>() } }
    }).createMachine({
      on: {
        go: ({ reject }) => {
          if (false) {
            // @ts-expect-error Unknown rejection type
            reject([{ type: 'unknown' }]);
            // @ts-expect-error Missing rejection payload
            reject([{ type: 'blocked' }]);
            // @ts-expect-error Rejection needs at least one reason
            reject([]);
          }
          return reject([{ type: 'blocked', count: 1 }]);
        }
      }
    });
    const actor = createActor(machine).start();
    const result = actor.getSnapshot().check({ type: 'go' });
    if (result.status === 'rejected' || result.status === 'partial') {
      expectTypeOf(result.rejections[0].reasons[0]).toMatchTypeOf<{
        type: 'blocked';
        count: number;
      }>();
    }
    actor.stop();
  });

  it('supports guarded JSON rejection branches, expressions, and round trips', () => {
    const definition = {
      '@exprLang': 'test',
      id: 'json',
      initial: 'editing',
      context: { available: 20, required: 50 },
      states: {
        editing: {
          on: {
            submit: [
              {
                guard: { type: 'insufficientBalance' },
                reject: [
                  {
                    type: 'balance.insufficient',
                    available: { '@expr': 'context.available' },
                    required: { '@expr': 'context.required' }
                  }
                ]
              },
              { target: 'submitted' }
            ]
          }
        },
        submitted: {}
      }
    } satisfies import('../src/index.ts').MachineJSON;
    const machine = machineFromJSON(definition, {
      guards: { insufficientBalance: () => true },
      evaluators: {
        test: ({ source, scope }) =>
          Reflect.get(Object(scope.context), source.split('.')[1])
      }
    });
    const actor = createActor(machine).start();
    expect(actor.getSnapshot().check({ type: 'submit' })).toEqual({
      status: 'rejected',
      rejections: [
        {
          source: 'json.editing',
          reasons: [
            { type: 'balance.insufficient', available: 20, required: 50 }
          ]
        }
      ]
    });
    actor.send({ type: 'submit' });
    expect(actor.getSnapshot().value).toBe('editing');
    expect(machineToJSON(machine)).toEqual(definition);
    actor.stop();
  });
  it('rejects enqueueing before rejection without running the queued effect', () => {
    const effect = vi.fn();
    const machine = createMachine({
      schemas: { rejections: { blocked: types<void>() } },
      on: {
        go: ({ reject }, enq) => {
          enq(effect);
          return reject([{ type: 'blocked' }]);
        }
      }
    });
    const actor = createActor(machine).start();
    expect(() => actor.getSnapshot().check({ type: 'go' })).toThrow(
      'cannot enqueue effects'
    );
    expect(effect).not.toHaveBeenCalled();
    actor.stop();
  });

  it('rejects spawning before rejection during a check', () => {
    const machine = setup({
      schemas: { rejections: { blocked: types<void>() } },
      actors: {
        worker: createMachine({})
      }
    }).createMachine({
      on: {
        go: ({ actors, reject }, enq) => {
          enq.spawn(actors.worker);
          return reject([{ type: 'blocked' }]);
        }
      }
    });
    const actor = createActor(machine).start();
    expect(() => actor.getSnapshot().check({ type: 'go' })).toThrow(
      'cannot enqueue effects'
    );
    actor.stop();
  });

  it('validates malformed rejection-shaped results before execution', () => {
    const machine = createMachine({
      schemas: { rejections: { blocked: types<void>() } },
      context: { count: 0 },
      on: {
        go: (() => ({ reject: [], context: { count: 1 } })) as any
      }
    });
    const actor = createActor(machine).start();
    expect(() => actor.getSnapshot().check({ type: 'go' })).toThrow('nonempty');
    expect(actor.getSnapshot().context.count).toBe(0);
    actor.stop();
  });

  it('keeps explicit rejection separate from unhandled and terminal events', () => {
    const onUnhandledEvent = vi.fn();
    const machine = createMachine({
      schemas: { rejections: { blocked: types<void>() } },
      initial: 'active',
      states: {
        active: {
          on: {
            go: ({ reject }) => reject([{ type: 'blocked' }]),
            finish: { target: 'done' }
          }
        },
        done: { type: 'final' }
      }
    });
    const actor = createActor(machine, { onUnhandledEvent }).start();
    const snapshot = actor.getSnapshot();
    expect(snapshot.check({ type: 'unknown' })).toEqual({
      status: 'unhandled'
    });
    actor.send({ type: 'go' });
    expect(onUnhandledEvent).not.toHaveBeenCalled();
    expect(snapshot.toJSON()).not.toHaveProperty('check');
    expect(actor.getPersistedSnapshot()).not.toHaveProperty('check');
    actor.send({ type: 'finish' });
    expect(actor.getSnapshot().check({ type: 'go' })).toEqual({
      status: 'unhandled'
    });
  });

  it('continues JSON alternatives after a failed guard and blocks them after rejection', () => {
    const makeMachine = (blocked: boolean) =>
      machineFromJSON(
        {
          initial: 'idle',
          states: {
            idle: {
              on: {
                go: [
                  { guard: { type: 'blocked' }, reject: [{ type: 'blocked' }] },
                  { target: 'done' }
                ]
              }
            },
            done: {}
          }
        },
        { guards: { blocked: () => blocked } }
      );
    for (const blocked of [false, true]) {
      const actor = createActor(makeMachine(blocked)).start();
      expect(actor.getSnapshot().check({ type: 'go' }).status).toBe(
        blocked ? 'rejected' : 'accepted'
      );
      actor.send({ type: 'go' });
      expect(actor.getSnapshot().value).toBe(blocked ? 'idle' : 'done');
      actor.stop();
    }
    expect(() =>
      machineFromJSON({
        on: {
          go: {
            // @ts-expect-error Invalid runtime JSON has an empty reasons array
            reject: []
          }
        }
      })
    ).toThrow('nonempty');
    expect(() =>
      machineFromJSON(
        JSON.parse(
          '{"on":{"go":{"reject":[{"type":"blocked"}],"target":"done"}}}'
        )
      )
    ).toThrow('cannot have');
  });

  it('does not loop on a rejecting eventless handler', () => {
    const machine = createMachine({
      schemas: { rejections: { blocked: types<void>() } },
      initial: 'idle',
      states: {
        idle: { always: ({ reject }) => reject([{ type: 'blocked' }]) }
      }
    });
    const actor = createActor(machine).start();
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().status).toBe('active');
    actor.stop();
  });

  it('validates rejection payloads against runtime schemas', () => {
    const machine = machineFromJSON(
      { on: { go: { reject: [{ type: 'blocked', count: 'wrong' }] } } },
      {
        schemas: {
          rejections: {
            blocked: {
              '~standard': {
                version: 1,
                vendor: 'test',
                validate: (value) =>
                  typeof value === 'object' &&
                  value &&
                  'count' in value &&
                  typeof value.count === 'number'
                    ? { value }
                    : { issues: [{ message: 'count must be a number' }] }
              }
            }
          }
        }
      }
    );
    const actor = createActor(machine).start();
    expect(() => actor.getSnapshot().check({ type: 'go' })).toThrow(
      'count must be a number'
    );
    actor.stop();
  });

  it('keeps wildcard rejection names literal', () => {
    const machine = setup({
      schemas: {
        rejections: { 'policy.*': types<{ count: number }>() }
      }
    }).createMachine({
      on: {
        go: ({ reject }) => {
          if (false) {
            // @ts-expect-error Rejection schema keys are exact names
            return reject([{ type: 'policy.limit', count: 1 }]);
          }
          return reject([{ type: 'policy.*', count: 1 }]);
        }
      }
    });
    const actor = createActor(machine).start();
    expect(actor.getSnapshot().check({ type: 'go' }).status).toBe('rejected');
    actor.stop();
  });

  it('types rejection payloads from transforming schema inputs', () => {
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        rejections: {
          blocked: z.object({ count: z.string().transform(Number) })
        }
      }
    }).createMachine({
      on: {
        go: ({ reject }) => {
          if (false) {
            // @ts-expect-error Runtime validation receives the schema input
            return reject([{ type: 'blocked', count: 1 }]);
          }
          return reject([{ type: 'blocked', count: '1' }]);
        }
      }
    });
    const actor = createActor(machine).start();
    expect(actor.getSnapshot().check({ type: 'go' }).status).toBe('rejected');
    actor.stop();
  });

  it('infers rejection schemas declared on setup-created machines', () => {
    const machine = setup({}).createMachine({
      schemas: { rejections: { blocked: types<{ count: number }>() } },
      on: {
        go: ({ reject }) => reject([{ type: 'blocked', count: 1 }])
      }
    });
    expectTypeOf<RejectionFrom<typeof machine>>().toMatchTypeOf<{
      type: 'blocked';
      count: number;
    }>();
    expectTypeOf<{ type: 'blocked'; count: number }>().toMatchTypeOf<
      RejectionFrom<typeof machine>
    >();
    const actor = createActor(machine).start();
    expect(actor.getSnapshot().check({ type: 'go' }).status).toBe('rejected');
    actor.stop();
  });
  it('revives code-authored rejection handlers with their bound reject helper', () => {
    const original = createMachine({
      schemas: { rejections: { blocked: types<void>() } },
      on: { go: ({ reject }) => reject([{ type: 'blocked' }]) }
    });
    const json = JSON.parse(JSON.stringify(machineToJSON(original)));
    const revived = machineFromJSON(json, {
      evaluators: {
        ts: ({ source, scope }) =>
          Function(`return (${source});`)()(scope, scope.enq)
      }
    });
    const actor = createActor(revived).start();
    expect(actor.getSnapshot().check({ type: 'go' }).status).toBe('rejected');
    actor.send({ type: 'go' });
    expect(actor.getSnapshot().status).toBe('active');
    actor.stop();
  });
  it('preserves optional runtime rejection input fields', () => {
    const schemas = {
      blocked: z.object({
        required: z.number(),
        count: z.number().optional(),
        label: z.string().default('default')
      })
    };
    const machine = createMachine({
      schemas: { rejections: schemas },
      on: {
        go: ({ reject }) => {
          if (false) {
            // @ts-expect-error The schema still requires required
            reject([{ type: 'blocked' }]);
            reject([
              { type: 'blocked', required: 1, count: 2, label: 'custom' }
            ]);
          }
          return reject([{ type: 'blocked', required: 1 }]);
        }
      }
    });
    const setupMachine = setup({
      schemas: { rejections: schemas }
    }).createMachine({
      on: { go: ({ reject }) => reject([{ type: 'blocked', required: 1 }]) }
    });
    expectTypeOf<RejectionFrom<typeof machine>>().toMatchTypeOf<{
      type: 'blocked';
      required: number;
      count?: number;
      label?: string;
    }>();
    for (const logic of [machine, setupMachine]) {
      const actor = createActor(logic).start();
      const result = actor.getSnapshot().check({ type: 'go' });
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected')
        expect(result.rejections[0].reasons).toEqual([
          { type: 'blocked', required: 1 }
        ]);
      actor.stop();
    }
  });

  it('uses extension rejection schemas for matching names and keeps the other base names', () => {
    const machine = setup({
      schemas: {
        rejections: {
          blocked: z.object({ old: z.number() }),
          quota: z.object({ limit: z.number() })
        }
      }
    })
      .extend({
        schemas: {
          rejections: { blocked: z.object({ replacement: z.string() }) }
        }
      })
      .createMachine({
        id: 'checkout',
        on: {
          go: ({ reject }) => {
            if (false) {
              // @ts-expect-error The extension replaces the base blocked schema
              reject([{ type: 'blocked', old: 1 }]);
            }
            return reject([
              { type: 'blocked', replacement: 'wait' },
              { type: 'quota', limit: 2 }
            ]);
          }
        }
      });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().check({ type: 'go' })).toEqual({
      status: 'rejected',
      rejections: [
        {
          source: 'checkout',
          reasons: [
            { type: 'blocked', replacement: 'wait' },
            { type: 'quota', limit: 2 }
          ]
        }
      ]
    });
    actor.stop();
  });

  it('preserves optional rejection maps in setup extensions', () => {
    const base = types<{ old: number }>();
    const replacement = types<{ replacement: string }>();
    const quota = types<{ limit: number }>();
    const loadSchemas = (): {
      rejections?: { blocked: typeof replacement; quota: typeof quota };
    } => ({});

    const optionalOnly = setup({}).extend({ schemas: loadSchemas() });
    expectTypeOf(optionalOnly.schemas.rejections).toEqualTypeOf<
      { blocked: typeof replacement; quota: typeof quota } | undefined
    >();
    expect(optionalOnly.schemas.rejections).toBeUndefined();

    const optionalMachine = optionalOnly.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            go: ({ reject }) =>
              reject([
                { type: 'blocked', replacement: 'wait' },
                { type: 'quota', limit: 2 }
              ])
          }
        }
      }
    });
    expectTypeOf<RejectionFrom<typeof optionalMachine>>().toMatchTypeOf<
      | { type: 'blocked'; replacement: string }
      | { type: 'quota'; limit: number }
    >();

    const withBase = setup({
      schemas: { rejections: { blocked: base } }
    }).extend({ schemas: loadSchemas() });
    expectTypeOf(withBase.schemas.rejections.blocked).toEqualTypeOf<
      typeof base | typeof replacement
    >();
    expect(withBase.schemas.rejections.blocked).toBe(base);

    const mergedMachine = withBase.createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            go: ({ reject }) =>
              reject([
                { type: 'blocked', old: 1 },
                { type: 'blocked', replacement: 'wait' },
                { type: 'quota', limit: 2 }
              ])
          }
        }
      }
    });
    expectTypeOf<RejectionFrom<typeof mergedMachine>>().toMatchTypeOf<
      | { type: 'blocked'; old: number }
      | { type: 'blocked'; replacement: string }
      | { type: 'quota'; limit: number }
    >();
  });

  it('merges setup and inline rejection maps with setup taking precedence', () => {
    const machine = setup({
      schemas: { rejections: { blocked: types<{ setup: number }>() } }
    }).createMachine({
      schemas: {
        rejections: {
          quota: types<{ limit: number }>(),
          blocked: types<{ inline: string }>()
        }
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            go: ({ reject }) => {
              if (false) {
                // @ts-expect-error Setup overrides the inline blocked payload
                reject([{ type: 'blocked', inline: 'wrong' }]);
              }
              return reject([
                { type: 'blocked', setup: 1 },
                { type: 'quota', limit: 2 }
              ]);
            }
          }
        }
      }
    });
    type Expected =
      | { type: 'blocked'; setup: number }
      | { type: 'quota'; limit: number };
    expectTypeOf<RejectionFrom<typeof machine>>().toMatchTypeOf<Expected>();
    expectTypeOf<Expected>().toMatchTypeOf<RejectionFrom<typeof machine>>();
    const actor = createActor(machine).start();
    const result = actor.getSnapshot().check({ type: 'go' });
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected')
      expect(result.rejections[0].reasons).toEqual([
        { type: 'blocked', setup: 1 },
        { type: 'quota', limit: 2 }
      ]);
    actor.stop();
  });
});
