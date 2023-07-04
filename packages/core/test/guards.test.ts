import { interpret, createMachine, raise } from '../src/index.ts';
import { and, not, or } from '../src/guards';
import { trackEntries } from './utils.ts';

describe('guard conditions', () => {
  interface LightMachineCtx {
    elapsed: number;
  }
  type LightMachineEvents =
    | { type: 'TIMER' }
    | {
        type: 'EMERGENCY';
        isEmergency?: boolean;
      }
    | { type: 'TIMER_COND_OBJ' }
    | { type: 'BAD_COND' };

  const lightMachine = createMachine<LightMachineCtx, LightMachineEvents>(
    {
      context: ({ input = {} }) => ({
        elapsed: input.elapsed || 0
      }),
      initial: 'green',
      states: {
        green: {
          on: {
            TIMER: [
              {
                target: 'green',
                guard: ({ context: { elapsed } }) => elapsed < 100
              },
              {
                target: 'yellow',
                guard: ({ context: { elapsed } }) =>
                  elapsed >= 100 && elapsed < 200
              }
            ],
            EMERGENCY: {
              target: 'red',
              guard: ({ event }) => !!event.isEmergency
            }
          }
        },
        yellow: {
          on: {
            TIMER: {
              target: 'red',
              guard: 'minTimeElapsed'
            },
            TIMER_COND_OBJ: {
              target: 'red',
              guard: {
                type: 'minTimeElapsed'
              }
            }
          }
        },
        red: {
          on: {
            BAD_COND: {
              target: 'red',
              guard: 'doesNotExist'
            }
          }
        }
      }
    },
    {
      guards: {
        minTimeElapsed: ({ context: { elapsed } }) =>
          elapsed >= 100 && elapsed < 200
      }
    }
  );

  it('should transition only if condition is met', () => {
    const actorRef1 = interpret(lightMachine, {
      input: { elapsed: 50 }
    }).start();
    actorRef1.send({ type: 'TIMER' });
    expect(actorRef1.getSnapshot().value).toEqual('green');

    const actorRef2 = interpret(lightMachine, {
      input: { elapsed: 120 }
    }).start();
    actorRef2.send({ type: 'TIMER' });
    expect(actorRef2.getSnapshot().value).toEqual('yellow');
  });

  it('should transition if condition based on event is met', () => {
    const actorRef = interpret(lightMachine).start();
    actorRef.send({
      type: 'EMERGENCY',
      isEmergency: true
    });
    expect(actorRef.getSnapshot().value).toEqual('red');
  });

  it('should not transition if condition based on event is not met', () => {
    const actorRef = interpret(lightMachine).start();
    actorRef.send({
      type: 'EMERGENCY'
    });
    expect(actorRef.getSnapshot().value).toEqual('green');
  });

  it('should not transition if no condition is met', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            TIMER: [
              {
                target: 'b',
                guard: ({ event: { elapsed } }) => elapsed > 200
              },
              {
                target: 'c',
                guard: ({ event: { elapsed } }) => elapsed > 100
              }
            ]
          }
        },
        b: {},
        c: {}
      }
    });

    const flushTracked = trackEntries(machine);
    const actor = interpret(machine).start();
    flushTracked();

    actor.send({ type: 'TIMER', elapsed: 10 });

    expect(actor.getSnapshot().value).toBe('a');
    expect(flushTracked()).toEqual([]);
  });

  it('should work with defined string transitions', () => {
    const actorRef = interpret(lightMachine, {
      input: { elapsed: 120 }
    }).start();
    actorRef.send({
      type: 'TIMER'
    });
    expect(actorRef.getSnapshot().value).toEqual('yellow');
    actorRef.send({
      type: 'TIMER'
    });
    expect(actorRef.getSnapshot().value).toEqual('red');
  });

  it('should work with guard objects', () => {
    const actorRef = interpret(lightMachine, {
      input: { elapsed: 150 }
    }).start();
    actorRef.send({
      type: 'TIMER'
    });
    expect(actorRef.getSnapshot().value).toEqual('yellow');
    actorRef.send({
      type: 'TIMER_COND_OBJ'
    });
    expect(actorRef.getSnapshot().value).toEqual('red');
  });

  it('should work with defined string transitions (condition not met)', () => {
    const machine = createMachine<LightMachineCtx, LightMachineEvents>(
      {
        context: {
          elapsed: 10
        },
        initial: 'yellow',
        states: {
          green: {
            on: {
              TIMER: [
                {
                  target: 'green',
                  guard: ({ context: { elapsed } }) => elapsed < 100
                },
                {
                  target: 'yellow',
                  guard: ({ context: { elapsed } }) =>
                    elapsed >= 100 && elapsed < 200
                }
              ],
              EMERGENCY: {
                target: 'red',
                guard: ({ event }) => !!event.isEmergency
              }
            }
          },
          yellow: {
            on: {
              TIMER: {
                target: 'red',
                guard: 'minTimeElapsed'
              }
            }
          },
          red: {}
        }
      },
      {
        guards: {
          minTimeElapsed: ({ context: { elapsed } }) =>
            elapsed >= 100 && elapsed < 200
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({
      type: 'TIMER'
    });

    expect(actorRef.getSnapshot().value).toEqual('yellow');
  });

  it('should throw if string transition is not defined', () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            BAD_COND: {
              guard: 'doesNotExist'
            }
          }
        }
      }
    });

    const actorRef = interpret(machine).start();

    expect(() => actorRef.send({ type: 'BAD_COND' }))
      .toThrowErrorMatchingInlineSnapshot(`
      "Unable to evaluate guard 'doesNotExist' in transition for event 'BAD_COND' in state node '(machine).foo':
      Guard 'doesNotExist' is not implemented.'."
    `);
  });
});

describe('guard conditions', () => {
  it('should guard against transition', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A2',
          states: {
            A0: {},
            A2: {}
          }
        },
        B: {
          initial: 'B0',
          states: {
            B0: {
              always: [
                {
                  target: 'B4',
                  guard: () => false
                }
              ],
              on: {
                T1: [
                  {
                    target: 'B1',
                    guard: () => false
                  }
                ]
              }
            },
            B1: {},
            B4: {}
          }
        }
      }
    });

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'T1' });

    expect(actorRef.getSnapshot().value).toEqual({
      A: 'A2',
      B: 'B0'
    });
  });

  it('should allow a matching transition', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A2',
          states: {
            A0: {},
            A2: {}
          }
        },
        B: {
          initial: 'B0',
          states: {
            B0: {
              always: [
                {
                  target: 'B4',
                  guard: () => false
                }
              ],
              on: {
                T2: [
                  {
                    target: 'B2',
                    guard: ({ state }) => state.matches('A.A2')
                  }
                ]
              }
            },
            B1: {},
            B2: {},
            B4: {}
          }
        }
      }
    });

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'T2' });

    expect(actorRef.getSnapshot().value).toEqual({
      A: 'A2',
      B: 'B2'
    });
  });

  it('should check guards with interim states', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A2',
          states: {
            A2: {
              on: {
                A: 'A3'
              }
            },
            A3: {
              always: 'A4'
            },
            A4: {
              always: 'A5'
            },
            A5: {}
          }
        },
        B: {
          initial: 'B0',
          states: {
            B0: {
              always: [
                {
                  target: 'B4',
                  guard: ({ state }) => state.matches('A.A4')
                }
              ]
            },
            B4: {}
          }
        }
      }
    });

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'A' });

    expect(actorRef.getSnapshot().value).toEqual({
      A: 'A5',
      B: 'B4'
    });
  });

  it('should be able to check source state tags when checking', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            MACRO: 'b'
          }
        },
        b: {
          entry: raise({ type: 'MICRO' }),
          tags: 'theTag',
          on: {
            MICRO: {
              guard: ({ state }) => state.hasTag('theTag'),
              target: 'c'
            }
          }
        },
        c: {}
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'MACRO' });

    expect(service.getSnapshot().value).toBe('c');
  });
});

describe('custom guards', () => {
  it('should evaluate custom guards', () => {
    interface Ctx {
      count: number;
    }
    interface Events {
      type: 'EVENT';
      value: number;
    }
    const machine = createMachine<Ctx, Events>(
      {
        id: 'custom',
        initial: 'inactive',
        context: {
          count: 0
        },
        states: {
          inactive: {
            on: {
              EVENT: {
                target: 'active',
                guard: {
                  type: 'custom',
                  params: { prop: 'count', op: 'greaterThan', compare: 3 }
                }
              }
            }
          },
          active: {}
        }
      },
      {
        guards: {
          custom: ({ context, event, guard }) => {
            const { prop, compare, op } = guard.params;
            if (op === 'greaterThan') {
              return (
                context[prop as keyof typeof context] + event.value > compare
              );
            }

            return false;
          }
        }
      }
    );

    const actorRef1 = interpret(machine).start();
    actorRef1.send({ type: 'EVENT', value: 4 });
    const passState = actorRef1.getSnapshot();

    expect(passState.value).toEqual('active');

    const actorRef2 = interpret(machine).start();
    actorRef2.send({ type: 'EVENT', value: 3 });
    const failState = actorRef2.getSnapshot();

    expect(failState.value).toEqual('inactive');
  });
});

describe('referencing guards', () => {
  const stringGuardFn = () => true;
  const guardsMachine = createMachine(
    {
      id: 'guards',
      initial: 'active',
      states: {
        active: {
          on: {
            EVENT: [
              { guard: 'string' },
              {
                guard: function guardFn() {
                  return true;
                }
              },
              {
                guard: {
                  type: 'object',
                  params: { foo: 'bar' }
                }
              }
            ]
          }
        }
      }
    },
    {
      guards: {
        string: stringGuardFn
      }
    }
  );

  const def = guardsMachine.definition;
  const [stringGuard, functionGuard, objectGuard] = def.states.active.on.EVENT;

  it('guard predicates should be able to be referenced from a string', () => {
    expect(stringGuard.guard!.predicate).toBeDefined();
    expect(stringGuard.guard!.type).toEqual('string');
  });

  it('guard predicates should be able to be referenced from a function', () => {
    expect(functionGuard.guard!.predicate).toBeDefined();
    expect(functionGuard.guard!.type).toEqual('guardFn');
  });

  it('guard predicates should be able to be referenced from an object', () => {
    expect(objectGuard.guard).toBeDefined();
    expect(objectGuard.guard).toEqual(
      expect.objectContaining({
        type: 'object',
        params: expect.objectContaining({ foo: 'bar' })
      })
    );
  });

  it('should throw for guards with missing predicates', () => {
    const machine = createMachine({
      id: 'invalid-predicate',
      initial: 'active',
      states: {
        active: {
          on: {
            EVENT: { target: 'inactive', guard: 'missing-predicate' }
          }
        },
        inactive: {}
      }
    });

    const actorRef = interpret(machine).start();

    expect(() => {
      actorRef.send({ type: 'EVENT' });
    }).toThrowErrorMatchingInlineSnapshot(`
      "Unable to evaluate guard 'missing-predicate' in transition for event 'EVENT' in state node 'invalid-predicate.active':
      Guard 'missing-predicate' is not implemented.'."
    `);
  });

  it('should be possible to reference a composite guard that only uses inline predicates', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: 'referenced'
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          referenced: not(() => false)
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should be possible to reference a composite guard that references other guards recursively', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: 'referenced'
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          truthy: () => true,
          falsy: () => false,
          referenced: or([
            () => false,
            not('truthy'),
            and([not('falsy'), 'truthy'])
          ])
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });
});

describe('guards - other', () => {
  it('should allow for a fallback target to be a simple string', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: [{ target: 'b', guard: () => false }, 'c']
          }
        },
        b: {},
        c: {}
      }
    });

    const service = interpret(machine).start();
    service.send({ type: 'EVENT' });

    expect(service.getSnapshot().value).toBe('c');
  });
});

describe('guards with child guards', () => {
  it('guards can contain child guards', () => {
    expect.assertions(3);

    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: {
                  type: 'testGuard',
                  children: [
                    {
                      type: 'customGuard',
                      predicate: () => true
                    },
                    { type: 'customGuard' }
                  ],
                  predicate: ({ guard }) => {
                    expect(guard.children).toHaveLength(2);
                    expect(
                      guard.children?.find(
                        (childGuard: any) => childGuard.type === 'customGuard'
                      )?.predicate
                    ).toBeInstanceOf(Function);

                    return true;
                  }
                }
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          customGuard: () => true
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });
});

describe('not() guard', () => {
  it('should guard with inline function', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              target: 'b',
              guard: not(() => false)
            }
          }
        },
        b: {}
      }
    });

    const actorRef = interpret(machine).start();

    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with string', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: not('falsy')
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          falsy: () => false
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with object', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: not({ type: 'greaterThan10', params: { value: 5 } })
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          greaterThan10: ({ guard }) => {
            return guard.params.value > 10;
          }
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with nested built-in guards', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: not(and([not('truthy'), 'truthy']))
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          truthy: () => true,
          falsy: () => false
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });
});

describe('and() guard', () => {
  it('should guard with inline function', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              target: 'b',
              guard: and([() => true, () => 1 + 1 === 2])
            }
          }
        },
        b: {}
      }
    });

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with string', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: and(['truthy', 'truthy'])
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          truthy: () => true
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with object', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: and([
                  { type: 'greaterThan10', params: { value: 11 } },
                  { type: 'greaterThan10', params: { value: 50 } }
                ])
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          greaterThan10: ({ guard }) => {
            return guard.params.value > 10;
          }
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with nested built-in guards', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: and([
                  () => true,
                  not('falsy'),
                  and([not('falsy'), 'truthy'])
                ])
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          truthy: () => true,
          falsy: () => false
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });
});

describe('or() guard', () => {
  it('should guard with inline function', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              target: 'b',
              guard: or([() => false, () => 1 + 1 === 2])
            }
          }
        },
        b: {}
      }
    });

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with string', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: or(['falsy', 'truthy'])
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          falsy: () => false,
          truthy: () => true
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with object', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: or([
                  { type: 'greaterThan10', params: { value: 4 } },
                  { type: 'greaterThan10', params: { value: 50 } }
                ])
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          greaterThan10: ({ guard }) => {
            return guard.params.value > 10;
          }
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with nested built-in guards', () => {
    const machine = createMachine(
      {
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: {
                target: 'b',
                guard: or([
                  () => false,
                  not('truthy'),
                  and([not('falsy'), 'truthy'])
                ])
              }
            }
          },
          b: {}
        }
      },
      {
        guards: {
          truthy: () => true,
          falsy: () => false
        }
      }
    );

    const actorRef = interpret(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });
});
