import { interpret, State, createMachine, raise } from '../src/index.ts';
import { and, not, or } from '../src/guards';
import { trackEntries } from './utils.ts';

describe('guard conditions', () => {
  interface LightMachineCtx {
    elapsed: number;
  }
  type LightMachineEvents =
    | { type: 'TIMER'; elapsed: number }
    | {
        type: 'EMERGENCY';
        isEmergency?: boolean;
      }
    | { type: 'TIMER_COND_OBJ' }
    | { type: 'BAD_COND' };

  const lightMachine = createMachine<LightMachineCtx, LightMachineEvents>(
    {
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
    expect(
      lightMachine.transition(
        State.from(
          'green',
          {
            elapsed: 50
          },
          lightMachine
        ),
        { type: 'TIMER', elapsed: 0 }
      ).value
    ).toEqual('green');

    expect(
      lightMachine.transition(
        State.from(
          'green',
          {
            elapsed: 120
          },
          lightMachine
        ),
        { type: 'TIMER', elapsed: 0 }
      ).value
    ).toEqual('yellow');
  });

  it('should transition if condition based on event is met', () => {
    expect(
      lightMachine.transition('green', {
        type: 'EMERGENCY',
        isEmergency: true
      }).value
    ).toEqual('red');
  });

  it('should not transition if condition based on event is not met', () => {
    expect(
      lightMachine.transition('green', {
        type: 'EMERGENCY'
      }).value
    ).toEqual('green');
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
    const nextState = lightMachine.transition(
      lightMachine.resolveState(
        State.from(
          'yellow',
          {
            elapsed: 150
          },
          lightMachine
        )
      ),
      { type: 'TIMER', elapsed: 10 }
    );
    expect(nextState.value).toEqual('red');
  });

  it('should work with guard objects', () => {
    const nextState = lightMachine.transition(
      lightMachine.resolveState(
        State.from(
          'yellow',
          {
            elapsed: 150
          },
          lightMachine
        )
      ),
      { type: 'TIMER_COND_OBJ' }
    );
    expect(nextState.value).toEqual('red');
  });

  it('should work with defined string transitions (condition not met)', () => {
    const nextState = lightMachine.transition(
      lightMachine.resolveState(
        State.from(
          'yellow',
          {
            elapsed: 10
          },
          lightMachine
        )
      ),
      { type: 'TIMER', elapsed: 10 }
    );
    expect(nextState.value).toEqual('yellow');
  });

  it('should throw if string transition is not defined', () => {
    expect(() =>
      lightMachine.transition('red', { type: 'BAD_COND' })
    ).toThrow();
  });
});

describe('guard conditions', () => {
  const machine = createMachine({
    type: 'parallel',
    states: {
      A: {
        initial: 'A0',
        states: {
          A0: {
            on: {
              A: 'A1'
            }
          },
          A1: {
            on: {
              A: 'A2'
            }
          },
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
            ],
            on: {
              T1: [
                {
                  target: 'B1',
                  guard: ({ state }) => state.matches('A.A1')
                }
              ],
              T2: [
                {
                  target: 'B2',
                  guard: ({ state }) => state.matches('A.A2')
                }
              ],
              T3: [
                {
                  target: 'B3',
                  guard: ({ state }) => state.matches('A.A3')
                }
              ]
            }
          },
          B1: {},
          B2: {},
          B3: {},
          B4: {}
        }
      }
    }
  });

  it('should guard against transition', () => {
    expect(
      machine.transition({ A: 'A2', B: 'B0' }, { type: 'T1' }).value
    ).toEqual({
      A: 'A2',
      B: 'B0'
    });
  });

  it('should allow a matching transition', () => {
    expect(
      machine.transition({ A: 'A2', B: 'B0' }, { type: 'T2' }).value
    ).toEqual({
      A: 'A2',
      B: 'B2'
    });
  });

  it('should check guards with interim states', () => {
    expect(
      machine.transition({ A: 'A2', B: 'B0' }, { type: 'A' }).value
    ).toEqual({
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

  it('should evaluate custom guards', () => {
    const passState = machine.transition(machine.initialState, {
      type: 'EVENT',
      value: 4
    });

    expect(passState.value).toEqual('active');

    const failState = machine.transition(machine.initialState, {
      type: 'EVENT',
      value: 3
    });

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

    expect(() => {
      machine.transition(machine.initialState, { type: 'EVENT' });
    }).toThrow();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });
    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
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

    const nextState = machine.transition(undefined, { type: 'EVENT' });

    expect(nextState.matches('b')).toBeTruthy();
  });
});
