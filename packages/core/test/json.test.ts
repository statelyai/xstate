import { createMachineFromConfig } from '../src/createMachineFromConfig';
import {
  createActor,
  createAsyncLogic,
  createMachine,
  createObservableLogic,
  serializeMachine,
  SimulatedClock,
  type EventRejection,
  type MachineJSON
} from '../src/index.ts';
import { standardSchemaValidator } from '../src/validation/index.ts';
import { BehaviorSubject } from 'rxjs';
import { z } from 'zod';

import * as machineSchema from '../src/machine.schema.json';

import Ajv from 'ajv';

const ajv = new Ajv();
const validate = ajv.compile(machineSchema);

const jsEvaluator = ({ source, scope }: any) =>
  Function('scope', `with (scope) { return (${source}); }`)(scope);

function expectSchemaValid(json: unknown) {
  validate(json);
  expect(validate.errors).toBeNull();
}

function expectSchemaInvalid(json: unknown) {
  validate(json);
  expect(validate.errors).not.toBeNull();
}

describe('json', () => {
  it('should serialize the machine', () => {
    const machine = createMachineFromConfig(
      {
        initial: 'foo',
        version: '1.0.0',
        context: {
          number: 0,
          string: 'hello'
        },
        invoke: [{ id: 'invokeId', src: 'invokeSrc' }],
        states: {
          testActions: {
            invoke: [{ id: 'invokeId', src: 'invokeSrc' }],
            entry: [
              { type: 'stringActionType' },
              {
                type: 'objectActionType'
              },
              {
                type: 'objectActionTypeWithExec',
                params: { other: 'any' }
              }
            ],
            on: {
              TO_FOO: {
                target: [
                  'testParallel.one.inactive',
                  'testParallel.two.inactive'
                ],
                guard: { type: 'isString', params: { string: 'hello' } }
              }
            },
            after: {
              1000: { target: 'bar' }
            }
          },
          foo: {},
          bar: {},
          testHistory: {
            type: 'history',
            history: 'deep',
            target: 'foo'
          },
          testFinal: {
            type: 'final',
            output: {
              something: 'else'
            }
          },
          testParallel: {
            type: 'parallel',
            states: {
              one: {
                initial: 'inactive',
                states: {
                  inactive: {}
                }
              },
              two: {
                initial: 'inactive',
                states: {
                  inactive: {}
                }
              }
            }
          }
        },
        output: { result: 42 }
      },
      {
        actors: {
          invokeSrc: createAsyncLogic({
            run: () => new Promise(() => {})
          })
        },
        actions: {
          stringActionType: () => {},
          objectActionType: () => {},
          objectActionTypeWithExec: () => {}
        },
        guards: {
          isString: () => true
        }
      }
    );

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));

    try {
      validate(json);
    } catch (err: any) {
      throw new Error(JSON.stringify(JSON.parse(err.message), null, 2));
    }

    expect(validate.errors).toBeNull();
  });

  it('should validate serialized code expressions', () => {
    const entry = () => {};
    const transition = () => ({ target: 'done' });
    const machine = createMachine({
      guards: {
        isReady: () => true
      },
      initial: 'idle',
      states: {
        idle: {
          entry,
          on: {
            GO: transition
          }
        },
        routed: {
          id: 'routed',
          route: () => true
        },
        done: {}
      }
    });

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));

    validate(json);

    expect(validate.errors).toBeNull();
  });

  it('revives serialized code actions and transitions with evaluators', () => {
    const entry = ({ context }: any) => ({
      context: { count: context.count + 1 }
    });
    const transition = ({ context }: any) =>
      context.count === 1 ? { target: 'done' } : undefined;
    const machine = createMachine({
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: {
          entry,
          on: {
            GO: transition
          }
        },
        done: {}
      }
    });
    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));
    const evaluator = ({ source, scope }: any) => {
      const fn = Function(`return (${source});`)();
      return fn(scope, scope.enq);
    };

    const actor = createActor(
      createMachineFromConfig(json, {
        evaluators: { ts: evaluator }
      })
    ).start();

    expect(actor.getSnapshot().context).toEqual({ count: 1 });

    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().value).toBe('done');
  });

  it('exposes named sources to revived code expressions', () => {
    const isOk = (ok: boolean) => ok;
    const track = vi.fn();
    const machine = createMachine({
      context: { ok: true },
      actions: { track },
      guards: { isOk },
      initial: 'idle',
      states: {
        idle: {
          entry: ({ actions }, enq) => {
            enq(actions.track);
          },
          on: {
            GO: ({ context, guards }) => {
              if (!guards.isOk(context.ok)) return;
              return { target: 'done' };
            }
          }
        },
        done: {}
      }
    });
    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));
    const evaluator = ({ source, scope }: any) => {
      const fn = Function(`return (${source});`)();
      return fn(scope, scope.enq);
    };

    const actor = createActor(
      createMachineFromConfig(json, {
        actions: { track },
        guards: { isOk },
        evaluators: { ts: evaluator }
      })
    ).start();

    expect(track).toHaveBeenCalledTimes(1);

    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().value).toBe('done');
  });

  it('revives serialized code routes with evaluators', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        blocked: {
          id: 'blocked',
          route: () => false
        },
        idle: {
          id: 'idle',
          route: {}
        }
      }
    });
    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));
    const evaluator = ({ source, scope }: any) => {
      const fn = Function(`return (${source});`)();
      return fn(scope);
    };

    expect(json.states.blocked.route).toMatchInlineSnapshot(`
      {
        "@code": "() => false",
        "@lang": "ts",
      }
    `);

    const actor = createActor(
      createMachineFromConfig(json, {
        evaluators: { ts: evaluator }
      })
    ).start();

    actor.send({ type: 'xstate.route', to: '#blocked' });

    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('should detect an invalid machine', () => {
    const invalidMachineConfig = {
      id: 'something',
      key: 'something',
      type: 'invalid type',
      states: {}
    };

    validate(invalidMachineConfig);
    expect(validate.errors).not.toBeNull();
  });

  it('should not double-serialize invoke transitions', () => {
    const machine = createMachineFromConfig(
      {
        initial: 'active',
        states: {
          active: {
            id: 'active',
            invoke: {
              src: 'someSrc',
              onDone: { target: 'foo' },
              onError: { target: 'bar' }
            },
            on: {
              EVENT: { target: 'foo' }
            }
          },
          foo: {},
          bar: {}
        }
      },
      {
        actors: {
          someSrc: createAsyncLogic({
            run: () => new Promise(() => {})
          })
        }
      }
    );

    const machineJSON = JSON.stringify(serializeMachine(machine));

    const machineObject = JSON.parse(machineJSON);

    const revivedMachine = createMachineFromConfig(machineObject, {
      actors: {
        someSrc: createAsyncLogic({
          run: () => new Promise(() => {})
        })
      }
    });

    // Invoke transitions stay on the invoke definition — not duplicated
    // into the `on` map.
    expect(machineObject.states.active.on).toMatchInlineSnapshot(`
      {
        "EVENT": {
          "target": "foo",
        },
      }
    `);
    expect(machineObject.states.active.invoke).toMatchInlineSnapshot(`
      {
        "onDone": {
          "target": "foo",
        },
        "onError": {
          "target": "bar",
        },
        "src": "someSrc",
      }
    `);

    // A second round-trip is byte-stable.
    expect(JSON.stringify(serializeMachine(revivedMachine))).toBe(machineJSON);

    const transitions = [
      ...revivedMachine.states.active.transitions.values()
    ].flat();
    expect(transitions.filter((t) => t.eventType === 'EVENT')).toHaveLength(1);
    expect(
      transitions.some(
        (t) =>
          t.eventType === 'xstate.done.actor' &&
          t.matches?.actorId === '0.active'
      )
    ).toBe(true);
    expect(
      transitions.some(
        (t) =>
          t.eventType === 'xstate.error.actor' &&
          t.matches?.actorId === '0.active'
      )
    ).toBe(true);
  });

  it('round-trips transition payload matches', () => {
    const machine = createMachineFromConfig({
      initial: 'pending',
      states: {
        pending: {
          on: {
            result: [
              { matches: { actorId: 'first' }, target: 'first' },
              { matches: { actorId: 'second' }, target: 'second' }
            ]
          }
        },
        first: {},
        second: {}
      }
    });
    const revived = createMachineFromConfig(
      JSON.parse(JSON.stringify(serializeMachine(machine)))
    );
    const actor = createActor(revived).start();

    actor.send({ type: 'result', actorId: 'second' });

    expect(actor.getSnapshot().value).toBe('second');
  });

  it('revives delayed transitions from JSON', () => {
    const clock = new SimulatedClock();
    const actor = createActor(
      createMachineFromConfig({
        initial: 'waiting',
        states: {
          waiting: {
            after: {
              10: { target: 'done' }
            }
          },
          done: {}
        }
      }),
      { clock }
    ).start();

    clock.increment(9);
    expect(actor.getSnapshot().value).toBe('waiting');
    clock.increment(1);
    expect(actor.getSnapshot().value).toBe('done');
  });

  it('revives state timeouts from JSON', () => {
    const clock = new SimulatedClock();
    const actor = createActor(
      createMachineFromConfig({
        initial: 'waiting',
        states: {
          waiting: {
            timeout: 10,
            onTimeout: { target: 'timedOut' }
          },
          timedOut: {}
        }
      }),
      { clock }
    ).start();

    clock.increment(10);
    expect(actor.getSnapshot().value).toBe('timedOut');
  });

  it('revives state tags and final output from JSON', () => {
    const actor = createActor(
      createMachineFromConfig({
        initial: 'pending',
        output: { ok: true },
        states: {
          pending: {
            on: { ACTIVATE: { target: 'active' } }
          },
          active: {
            tags: ['complete'],
            on: { FINISH: { target: 'done' } }
          },
          done: {
            type: 'final'
          }
        }
      })
    ).start();

    actor.send({ type: 'ACTIVATE' });
    expect(actor.getSnapshot().hasTag('complete')).toBe(true);
    actor.send({ type: 'FINISH' });
    expect(actor.getSnapshot().output).toEqual({ ok: true });
  });

  it('revives invoke input, completion transitions, and source maps', async () => {
    let receivedInput: unknown;
    const worker = createAsyncLogic<number, { count: number }>({
      run: async ({ input }) => {
        receivedInput = input;
        return input.count;
      }
    });

    const actor = createActor(
      createMachineFromConfig(
        {
          initial: 'loading',
          states: {
            loading: {
              invoke: {
                src: 'worker',
                input: { count: 42 },
                onDone: {
                  target: 'done'
                }
              }
            },
            done: {}
          }
        },
        {
          actors: { worker }
        }
      )
    ).start();

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('done');
    });
    expect(receivedInput).toEqual({ count: 42 });
  });

  it('revives invoke source refs when actor sources are provided', async () => {
    const worker = createAsyncLogic({
      run: async () => 42
    });

    const actor = createActor(
      createMachineFromConfig(
        {
          initial: 'loading',
          states: {
            loading: {
              invoke: {
                src: 'worker',
                onDone: { target: 'done' }
              }
            },
            done: {}
          }
        },
        { actors: { worker } }
      )
    ).start();

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('done');
    });
  });

  it('rejects missing action sources', () => {
    expect(() =>
      createMachineFromConfig({
        entry: [{ type: 'track' }]
      })
    ).toThrow('Missing action source "track"');
  });

  it('rejects initial states that do not exist', () => {
    expect(() =>
      createMachineFromConfig({
        initial: 'strat',
        states: { start: {} }
      })
    ).toThrow('Invalid initial state at $.initial');

    expect(() =>
      createMachineFromConfig({
        initial: 'start',
        states: {
          start: {},
          details: { initial: 'nmae', states: { name: {} } }
        }
      })
    ).toThrow('Invalid initial state at $.states.details.initial');
  });

  it('rejects missing guard sources', () => {
    expect(() =>
      createMachineFromConfig({
        initial: 'idle',
        states: {
          idle: {
            on: {
              GO: {
                target: 'done',
                guard: { type: 'ready' }
              }
            }
          },
          done: {}
        }
      })
    ).toThrow('Missing guard source "ready"');
  });

  it('rejects an unknown key on a state node', () => {
    const json = {
      initial: 'idle',
      states: {
        idle: { whatever: 'xyz' },
        done: {}
      }
    };

    // machine.schema.json leaves state nodes open (additionalProperties: true),
    // so it does not catch this; createMachineFromConfig must.
    expectSchemaValid(json);
    expect(() => createMachineFromConfig(json as any)).toThrow(
      'Unknown key "whatever" at $.states.idle'
    );
  });

  it('rejects an unknown key on a transition object', () => {
    const json = {
      initial: 'idle',
      states: {
        idle: { on: { GO: { target: 'done', bogusKey: true } } },
        done: {}
      }
    };

    expectSchemaInvalid(json);
    expect(() => createMachineFromConfig(json as any)).toThrow(
      'Unknown key "bogusKey" at $.states.idle.on.GO'
    );
  });

  it('rejects a misspelled "guard" key on a transition object instead of silently dropping the guard', () => {
    const json = {
      initial: 'idle',
      states: {
        idle: { on: { GO: { target: 'done', gaurd: { type: 'ready' } } } },
        done: {}
      }
    };

    expectSchemaInvalid(json);
    expect(() => createMachineFromConfig(json as any)).toThrow(
      'Unknown key "gaurd" at $.states.idle.on.GO'
    );
  });

  it('revives serialized numeric delays from root delay maps', () => {
    const clock = new SimulatedClock();
    const actor = createActor(
      createMachineFromConfig({
        delays: {
          short: 10
        },
        initial: 'waiting',
        states: {
          waiting: {
            after: {
              short: { target: 'done' }
            }
          },
          done: {}
        }
      }),
      { clock }
    ).start();

    clock.increment(9);
    expect(actor.getSnapshot().value).toBe('waiting');
    clock.increment(1);
    expect(actor.getSnapshot().value).toBe('done');
  });

  it('revives invoke registryKey from JSON', () => {
    const worker = createAsyncLogic({
      run: () => new Promise(() => {})
    });

    const actor = createActor(
      createMachineFromConfig(
        {
          initial: 'loading',
          states: {
            loading: {
              invoke: {
                src: 'worker',
                registryKey: 'workerSystem'
              }
            }
          }
        },
        { actors: { worker } }
      )
    ).start();

    expect(actor.system.get('workerSystem')).toBeDefined();
  });

  it('revives invoke onSnapshot from JSON', async () => {
    const subject = new BehaviorSubject(0);
    const worker = createObservableLogic(() => subject);
    const actor = createActor(
      createMachineFromConfig(
        {
          initial: 'watching',
          states: {
            watching: {
              invoke: {
                src: 'worker',
                onSnapshot: { target: 'seen' }
              }
            },
            seen: {}
          }
        },
        { actors: { worker } }
      )
    ).start();

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('seen');
    });
  });

  it('revives transition input from JSON', () => {
    const actor = createActor(
      createMachineFromConfig({
        initial: 'idle',
        states: {
          idle: {
            on: {
              GO: {
                target: 'active',
                input: 42
              }
            }
          },
          active: {
            id: 'active'
          }
        }
      })
    ).start();

    actor.send({ type: 'GO' });

    expect((actor.getSnapshot() as any)._stateInputs.active).toBe(42);
  });

  it('revives invoke timeouts from JSON', () => {
    const clock = new SimulatedClock();
    const worker = createAsyncLogic({
      run: () => new Promise(() => {})
    });

    const actor = createActor(
      createMachineFromConfig(
        {
          initial: 'loading',
          states: {
            loading: {
              invoke: {
                src: 'worker',
                timeout: 10,
                onTimeout: { target: 'timedOut' }
              }
            },
            timedOut: {}
          }
        },
        { actors: { worker } }
      ),
      { clock }
    ).start();

    clock.increment(10);
    expect(actor.getSnapshot().value).toBe('timedOut');
  });

  it('rejects missing evaluators for expressions', () => {
    expect(() =>
      createMachineFromConfig({
        '@exprLang': 'js',
        context: {
          count: { '@expr': 'input.count' }
        }
      })
    ).toThrow("Missing evaluator for @lang 'js' at $.context.count");
  });

  it('rejects expressions without a top-level or local language', () => {
    expect(() =>
      createMachineFromConfig({
        context: {
          count: { '@expr': 'input.count' }
        }
      })
    ).toThrow('Missing @exprLang for expression at $.context.count');
  });

  it('uses local expression language overrides and passes evaluator metadata', () => {
    const calls: any[] = [];
    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          context: {
            count: { '@expr': 'input.count', '@lang': 'other' }
          }
        },
        {
          evaluators: {
            js: () => {
              throw new Error('default evaluator should not be used');
            },
            other: (args) => {
              calls.push(args);
              return (args.scope.input as any).count;
            }
          }
        }
      ),
      { input: { count: 7 } }
    ).start();

    expect(actor.getSnapshot().context).toEqual({ count: 7 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(
      expect.objectContaining({
        source: 'input.count',
        kind: 'expr',
        slot: 'context',
        path: '$.context.count'
      })
    );
    expect(calls[0].scope.input).toEqual({ count: 7 });
  });

  it('passes the JSON location of nested expressions to the evaluator, not a slot placeholder', () => {
    const paths: Record<string, string> = {};
    const evaluator = ({ source, scope, path }: any) => {
      paths[source] = path;
      return Function('scope', `with (scope) { return (${source}); }`)(scope);
    };
    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          initial: 'outer',
          states: {
            outer: {
              initial: 'inner',
              states: {
                inner: {
                  entry: [{ '@expr': '"entered"' }],
                  on: {
                    next: { guard: { '@expr': 'true' }, target: '#done' }
                  }
                }
              }
            },
            done: { id: 'done', type: 'final' }
          }
        },
        { evaluators: { js: evaluator } }
      )
    ).start();
    actor.send({ type: 'next' });

    expect(paths['"entered"']).toBe('$.states.outer.states.inner.entry[0]');
    expect(paths['true']).toBe('$.states.outer.states.inner.on.next.guard');
  });

  it('resolves expressions in delays and state timeouts', () => {
    const clock = new SimulatedClock();
    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          context: {
            afterMs: 10,
            timeoutMs: 20
          },
          delays: {
            short: { duration: { '@expr': 'context.afterMs' } }
          },
          initial: 'waiting',
          states: {
            waiting: {
              after: {
                short: { target: 'timed' }
              }
            },
            timed: {
              timeout: { '@expr': 'context.timeoutMs' },
              onTimeout: { target: 'done' }
            },
            done: {}
          }
        },
        { evaluators: { js: jsEvaluator } }
      ),
      { clock }
    ).start();

    clock.increment(9);
    expect(actor.getSnapshot().value).toBe('waiting');
    clock.increment(1);
    expect(actor.getSnapshot().value).toBe('timed');
    clock.increment(19);
    expect(actor.getSnapshot().value).toBe('timed');
    clock.increment(1);
    expect(actor.getSnapshot().value).toBe('done');
  });

  it('resolves expressions in invoke timeout and invoke input', () => {
    const clock = new SimulatedClock();
    let receivedInput: unknown;
    const worker = createAsyncLogic({
      run: ({ input }) => {
        receivedInput = input;
        return new Promise(() => {});
      }
    });

    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          context: {
            value: 42,
            timeoutMs: 10
          },
          initial: 'loading',
          states: {
            loading: {
              invoke: {
                src: 'worker',
                input: {
                  value: { '@expr': 'context.value' }
                },
                timeout: { '@expr': 'context.timeoutMs' },
                onTimeout: { target: 'timedOut' }
              }
            },
            timedOut: {}
          }
        },
        {
          actors: { worker },
          evaluators: { js: jsEvaluator }
        }
      ),
      { clock }
    ).start();

    expect(receivedInput).toEqual({ value: 42 });
    clock.increment(10);
    expect(actor.getSnapshot().value).toBe('timedOut');
  });

  it('resolves expressions in transition input and final output', () => {
    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          context: {
            count: 2
          },
          output: { '@expr': 'context.count * 2' },
          initial: 'idle',
          states: {
            idle: {
              on: {
                GO: {
                  target: 'done',
                  input: { '@expr': 'context.count + event.by' }
                }
              }
            },
            done: {
              id: 'done',
              type: 'final'
            }
          }
        },
        { evaluators: { js: jsEvaluator } }
      )
    ).start();

    actor.send({ type: 'GO', by: 3 });

    expect((actor.getSnapshot() as any)._stateInputs.done).toBe(5);
    expect(actor.getSnapshot().output).toBe(4);
  });

  it('resolves expressions nested in final output', () => {
    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          context: {
            count: 2
          },
          initial: 'idle',
          states: {
            idle: {
              on: {
                GO: { target: 'done' }
              }
            },
            done: {
              type: 'final',
              output: {
                total: { '@expr': 'context.count * 2' },
                items: [{ '@expr': 'context.count' }, 'static']
              }
            }
          }
        },
        { evaluators: { js: jsEvaluator } }
      )
    ).start();

    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().output).toEqual({
      total: 4,
      items: [2, 'static']
    });
  });

  it('revives serializable choice states and expression values', () => {
    const evaluator = ({ source, scope }: any) =>
      Function('scope', `with (scope) { return (${source}); }`)(scope);
    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          context: {
            tier: { '@expr': 'input.tier' },
            count: 0
          },
          initial: 'routing',
          states: {
            routing: {
              type: 'choice',
              choice: [
                {
                  when: { '@expr': 'context.tier === "vip"' },
                  target: 'vip',
                  context: {
                    count: { '@expr': 'context.count + 1' }
                  }
                },
                { target: 'standard' }
              ]
            },
            vip: {},
            standard: {}
          }
        },
        {
          evaluators: {
            js: evaluator
          }
        }
      ),
      { input: { tier: 'vip' } }
    ).start();

    expect(actor.getSnapshot().value).toBe('vip');
    expect(actor.getSnapshot().context).toEqual({
      tier: 'vip',
      count: 1
    });
  });

  it('rejects choice fallback branches before the last branch', () => {
    expect(() =>
      createMachineFromConfig({
        initial: 'routing',
        states: {
          routing: {
            type: 'choice',
            choice: [
              { target: 'standard' },
              { when: { '@expr': 'true', '@lang': 'js' }, target: 'vip' }
            ]
          },
          standard: {},
          vip: {}
        }
      })
    ).toThrow(
      'Choice fallback branch at $.states.routing.choice[0] must be last.'
    );
  });

  it('errors when a choice state has no matching branch', () => {
    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          initial: 'routing',
          states: {
            routing: {
              type: 'choice',
              choice: [{ when: { '@expr': 'false' }, target: 'done' }]
            },
            done: {}
          }
        },
        { evaluators: { js: jsEvaluator } }
      )
    );
    actor.subscribe({ error: () => {} });

    actor.start();

    expect(actor.getSnapshot().status).toBe('error');
    expect((actor.getSnapshot() as any).error.message).toBe(
      'Choice state at $.states.routing.choice did not match any branch.'
    );
  });

  it('runs declarative named actions with expression params', () => {
    const evaluator = ({ source, scope }: any) =>
      Function('scope', `with (scope) { return (${source}); }`)(scope);
    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          context: {
            count: 0
          },
          actions: {
            setCount: {
              type: '@xstate.assign',
              context: {
                count: { '@expr': 'params.value' }
              }
            }
          },
          entry: [{ type: 'setCount', params: { value: 2 } }]
        },
        {
          evaluators: {
            js: evaluator
          }
        }
      )
    ).start();

    expect(actor.getSnapshot().context).toEqual({
      count: 2
    });
  });

  it('runs declarative named action arrays', () => {
    const actor = createActor(
      createMachineFromConfig({
        context: {
          count: 0
        },
        actions: {
          incTwice: [
            {
              type: '@xstate.assign',
              context: { count: 1 }
            },
            {
              type: '@xstate.assign',
              context: { count: 2 }
            }
          ]
        },
        entry: [{ type: 'incTwice' }]
      })
    ).start();

    expect(actor.getSnapshot().context).toEqual({ count: 2 });
  });

  it('lets each action in a list read the context written by earlier actions', () => {
    const seen: number[] = [];
    const inc = {
      type: '@xstate.assign',
      context: { count: { '@expr': 'context.count + 1' } }
    } as const;
    const counted = { type: 'COUNTED', count: { '@expr': 'context.count' } };
    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          context: { count: 0, double: 0 },
          actions: { incTwice: [inc, inc] },
          entry: [
            inc,
            { type: 'incTwice' },
            { '@expr': '({ context: { double: context.count * 2 } })' },
            { type: 'track', params: { count: { '@expr': 'context.count' } } },
            { type: '@xstate.raise', event: counted }
          ],
          on: {
            COUNTED: {
              actions: [
                { type: 'track', params: { count: { '@expr': 'event.count' } } }
              ]
            }
          }
        },
        {
          evaluators: { js: jsEvaluator },
          actions: {
            track: (params: { count: number }) => {
              seen.push(params.count);
            }
          }
        }
      )
    ).start();

    expect(actor.getSnapshot().context).toEqual({ count: 3, double: 6 });
    expect(seen).toEqual([3, 3]);
  });

  it('rejects circular declarative named actions', () => {
    expect(() =>
      createMachineFromConfig({
        actions: {
          a: { type: 'b' },
          b: { type: 'a' }
        },
        entry: [{ type: 'a' }]
      })
    ).toThrow('Circular action reference: a -> b -> a');
  });

  it('rejects circular declarative named guards', () => {
    expect(() =>
      createMachineFromConfig({
        guards: {
          a: { when: { type: 'b' } },
          b: { when: { type: 'a' } }
        },
        initial: 'idle',
        states: {
          idle: { on: { GO: { guard: { type: 'a' }, target: 'done' } } },
          done: {}
        }
      })
    ).toThrow('Circular guard reference: a -> b -> a');

    expect(() =>
      createMachineFromConfig({
        guards: {
          a: { when: { type: 'a' } }
        }
      })
    ).toThrow('Circular guard reference: a -> a');

    expect(() =>
      createMachineFromConfig({
        guards: {
          a: {
            when: { type: 'xstate.not', params: { guard: { type: 'a' } } }
          }
        }
      })
    ).toThrow('Circular guard reference: a -> a');
  });

  it('rejects missing guard sources inside xstate.not', () => {
    const createWithGuard = (guard: any) =>
      createMachineFromConfig(
        {
          initial: 'idle',
          states: {
            idle: { on: { GO: { guard, target: 'done' } } },
            done: {}
          }
        },
        { guards: { ready: () => true } }
      );

    expect(() =>
      createWithGuard({
        type: 'xstate.not',
        params: {
          guard: { type: 'xstate.not', params: { guard: { type: 'raedy' } } }
        }
      })
    ).toThrow('Missing guard source "raedy"');
    expect(() => createWithGuard({ type: 'xstate.not' })).toThrow(
      'Missing guard at $.states.idle.on.GO.guard.params.guard'
    );
  });

  it('negates declarative named guards and expressions with xstate.not', () => {
    const createWithGuard = (guard: any) =>
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          context: { ready: false },
          guards: {
            isReady: { when: { '@expr': 'context.ready' } }
          },
          initial: 'idle',
          states: {
            idle: { on: { GO: { guard, target: 'done' } } },
            done: {}
          }
        },
        { evaluators: { js: jsEvaluator } }
      );

    for (const inner of [{ type: 'isReady' }, { '@expr': 'context.ready' }]) {
      const actor = createActor(
        createWithGuard({ type: 'xstate.not', params: { guard: inner } })
      ).start();
      actor.send({ type: 'GO' });
      expect(actor.getSnapshot().value).toBe('done');
    }
  });

  it('rejects xstate.stateIn references to unknown state IDs', () => {
    const createWithStateId = (stateId?: string) =>
      createMachineFromConfig({
        id: 'm',
        initial: 'idle',
        states: {
          idle: {
            on: {
              GO: {
                guard: { type: 'xstate.stateIn', params: { stateId } },
                target: 'done'
              }
            }
          },
          done: {}
        }
      });

    expect(() => createWithStateId('#idle')).toThrow(
      'Unknown state ID "#idle" at $.states.idle.on.GO.guard.params.stateId'
    );
    expect(() => createWithStateId()).toThrow(
      'Missing state ID at $.states.idle.on.GO.guard.params.stateId'
    );

    const actor = createActor(createWithStateId('#m.idle')).start();
    actor.send({ type: 'GO' });
    expect(actor.getSnapshot().value).toBe('done');
  });

  it('runs declarative named guards', () => {
    const evaluator = ({ source, scope }: any) =>
      Function('scope', `with (scope) { return (${source}); }`)(scope);
    const actor = createActor(
      createMachineFromConfig(
        {
          '@exprLang': 'js',
          context: {
            ready: true
          },
          guards: {
            isReady: {
              when: { '@expr': 'context.ready' }
            }
          },
          initial: 'idle',
          states: {
            idle: {
              on: {
                GO: { guard: { type: 'isReady' }, target: 'done' }
              }
            },
            done: {}
          }
        },
        {
          evaluators: {
            js: evaluator
          }
        }
      )
    ).start();

    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().value).toBe('done');
  });

  it('validates JSON Schema-shaped action, guard, and actor source schemas', () => {
    expectSchemaValid({
      schemas: {
        actions: {
          track: {
            params: {
              type: 'object',
              properties: {
                key: { type: 'string' }
              },
              required: ['key']
            }
          }
        },
        guards: {
          allowed: {
            params: {
              type: 'object',
              properties: {
                role: { type: 'string' }
              }
            }
          }
        },
        actors: {
          worker: {
            input: {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            },
            output: {
              type: 'object',
              properties: {
                ok: { type: 'boolean' }
              }
            },
            emitted: {
              PROGRESS: {
                type: 'object',
                properties: {
                  percent: { type: 'number' }
                }
              }
            }
          }
        }
      }
    });
  });

  it('rejects invalid serializable machine schema shapes', () => {
    expectSchemaInvalid({
      initial: 'on',
      states: {
        on: {
          initial: 'active',
          states: {
            active: {},
            history: { type: 'history' }
          }
        }
      }
    });

    expectSchemaInvalid({
      initial: 'on',
      states: {
        on: {
          initial: 'active',
          states: {
            active: {},
            history: { type: 'history', target: [] }
          }
        }
      }
    });

    expectSchemaInvalid({
      initial: 'routing',
      states: {
        routing: {
          type: 'choice',
          choice: [
            {
              target: 'done',
              actions: []
            }
          ]
        },
        done: {}
      }
    });

    expectSchemaInvalid({
      actions: {
        track: {
          params: {}
        }
      }
    });

    expectSchemaInvalid({
      guards: {
        ready: {
          '@expr': 'true'
        }
      }
    });

    expectSchemaInvalid({
      schemas: {
        actions: {
          track: {}
        }
      }
    });

    expectSchemaInvalid({
      schemas: {
        actors: {
          worker: {
            schemas: {}
          }
        }
      }
    });
  });

  it('rejects event and emitted payload schemas that redeclare event type', () => {
    expectSchemaValid({
      schemas: {
        events: {
          SUBMIT: {
            type: 'object',
            properties: {
              value: { type: 'string' }
            }
          }
        },
        emitted: {
          TRACKED: {
            type: 'object',
            properties: {
              key: { type: 'string' }
            }
          }
        }
      }
    });

    expectSchemaInvalid({
      schemas: {
        events: {
          SUBMIT: {
            type: 'object',
            properties: {
              type: { const: 'SUBMIT' },
              value: { type: 'string' }
            }
          }
        }
      }
    });

    expectSchemaInvalid({
      schemas: {
        actors: {
          worker: {
            emitted: {
              PROGRESS: {
                type: 'object',
                properties: {
                  type: { const: 'PROGRESS' },
                  percent: { type: 'number' }
                }
              }
            }
          }
        }
      }
    });
  });

  it('validates revived machines against runtime schemas from sources', () => {
    const json: MachineJSON = {
      '@exprLang': 'js',
      context: { email: '' },
      schemas: {
        events: {
          'email.change': {
            type: 'object',
            properties: { value: { type: 'string' } }
          }
        }
      },
      initial: 'editing',
      states: {
        editing: {
          on: {
            'email.change': {
              context: { email: { '@expr': 'event.value' } }
            }
          }
        }
      }
    };
    const machine = createMachineFromConfig(json, {
      evaluators: { js: jsEvaluator },
      schemas: {
        events: { 'email.change': z.object({ value: z.string() }) }
      },
      validator: standardSchemaValidator()
    });
    const rejections: EventRejection[] = [];
    const actor = createActor(machine.provide({}), {
      onRejectedEvent: (rejection) => rejections.push(rejection)
    }).start();

    actor.send({ type: 'email.change', value: 12345 });

    expect(actor.getSnapshot().context).toEqual({ email: '' });
    expect(rejections.map((rejection) => rejection.reason)).toEqual([
      'invalidEvent'
    ]);

    actor.send({ type: 'email.change', value: 'a@b.c' });

    expect(actor.getSnapshot().context).toEqual({ email: 'a@b.c' });
    // runtime schemas are not part of the definition
    expect(serializeMachine(machine)).toEqual(json);
  });
});

describe('reserved source names', () => {
  it("rejects source names using the reserved '@xstate.' prefix", () => {
    expect(() =>
      createMachineFromConfig({
        initial: 'a',
        states: { a: {} }
      } as any).provide({
        actions: { '@xstate.raise': () => {} } as any
      })
    ).toThrow(
      "Invalid actions name '@xstate.raise': the '@xstate.' prefix is reserved"
    );
  });
});

it('rejects string transition targets', () => {
  const json = {
    initial: 'green',
    states: {
      green: { on: { TIMER: 'yellow' } },
      yellow: {}
    }
  };

  expectSchemaInvalid(json);
  expect(() => createMachineFromConfig(json as any)).toThrow(
    'Invalid transition at $.states.green.on.TIMER: use { "target": "yellow" } instead of a string'
  );
});

it('rejects circular declarative named guards', () => {
  expect(() =>
    createMachineFromConfig({
      guards: {
        a: { when: { type: 'b' } },
        b: { when: { type: 'a' } }
      },
      initial: 'idle',
      states: {
        idle: { on: { GO: { guard: { type: 'a' }, target: 'done' } } },
        done: {}
      }
    })
  ).toThrow('Circular guard reference: a -> b -> a');

  expect(() =>
    createMachineFromConfig({
      guards: {
        a: { when: { type: 'a' } }
      }
    })
  ).toThrow('Circular guard reference: a -> a');
});
