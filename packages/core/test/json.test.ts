import { createMachineFromConfig } from '../src/createMachineFromConfig';
import {
  createActor,
  createAsyncLogic,
  createMachine,
  createObservableLogic,
  serializeMachine,
  SimulatedClock
} from '../src/index.ts';
import { BehaviorSubject } from 'rxjs';

import * as machineSchema from '../src/machine.schema.json';

import Ajv from 'ajv';

const ajv = new Ajv();
const validate = ajv.compile(machineSchema);

describe('json', () => {
  it('should serialize the machine', () => {
    const machine = createMachineFromConfig({
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
              target: ['foo', 'bar'],
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
          history: 'deep'
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
    });

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
        done: {}
      }
    });

    const json = JSON.parse(JSON.stringify(serializeMachine(machine)));

    validate(json);

    expect(validate.errors).toBeNull();
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
    const machine = createMachineFromConfig({
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
    });

    const machineJSON = JSON.stringify(serializeMachine(machine));

    const machineObject = JSON.parse(machineJSON);

    const revivedMachine = createMachineFromConfig(machineObject);

    // Invoke transitions stay on the invoke definition — not duplicated
    // into the `on` map.
    expect(machineObject.states.active.on).toEqual({
      EVENT: { target: 'foo' }
    });
    expect(machineObject.states.active.invoke).toEqual({
      src: 'someSrc',
      onDone: { target: 'foo' },
      onError: { target: 'bar' }
    });

    // A second round-trip is byte-stable.
    expect(JSON.stringify(serializeMachine(revivedMachine))).toBe(machineJSON);

    const transitions = [
      ...revivedMachine.states.active.transitions.values()
    ].flat();
    expect(transitions.filter((t) => t.eventType === 'EVENT')).toHaveLength(1);
    expect(
      transitions.some((t) => t.eventType === 'xstate.done.actor.0.active')
    ).toBe(true);
    expect(
      transitions.some((t) => t.eventType === 'xstate.error.actor.0.active')
    ).toBe(true);
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

  it('revives invoke input, completion transitions, and implementation maps', async () => {
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
          actorSources: { worker }
        }
      )
    ).start();

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('done');
    });
    expect(receivedInput).toEqual({ count: 42 });
  });

  it('revives invoke source markers when actor implementations are provided', async () => {
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
                src: { $unserializable: 'actor', id: 'worker' },
                onDone: { target: 'done' }
              }
            },
            done: {}
          }
        },
        { actorSources: { worker } }
      )
    ).start();

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('done');
    });
  });

  it('rejects missing root action implementations declared by markers', () => {
    expect(() =>
      createMachineFromConfig({
        actions: {
          track: { $unserializable: 'function', id: 'track' }
        },
        entry: [{ type: 'track' }]
      })
    ).toThrow('Missing actions.track');
  });

  it('rejects missing root guard implementations declared by markers', () => {
    expect(() =>
      createMachineFromConfig({
        guards: {
          ready: { $unserializable: 'function', id: 'ready' }
        },
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
    ).toThrow('Missing guards.ready');
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
        { actorSources: { worker } }
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
        { actorSources: { worker } }
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
        { actorSources: { worker } }
      ),
      { clock }
    ).start();

    clock.increment(10);
    expect(actor.getSnapshot().value).toBe('timedOut');
  });

  it('rejects unresolved unserializable markers instead of silently dropping them', () => {
    expect(() =>
      createMachineFromConfig({
        entry: [{ $unserializable: 'function', id: 'entry' } as any]
      })
    ).toThrow('Unresolved function at $.entry[0]');
  });
});

describe('reserved implementation names', () => {
  it("rejects implementation names using the reserved '@xstate.' prefix", () => {
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
