import { createMachine, createActor, matchesState } from '../src';
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

  const lightMachine = createMachine(
    {
      types: {} as {
        input: { elapsed?: number };
        context: LightMachineCtx;
        events: LightMachineEvents;
      },
      context: ({ input = {} }) => ({
        elapsed: input.elapsed ?? 0
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
    const actorRef1 = createActor(lightMachine, {
      input: { elapsed: 50 }
    }).start();
    actorRef1.send({ type: 'TIMER' });
    expect(actorRef1.getSnapshot().value).toEqual('green');

    const actorRef2 = createActor(lightMachine, {
      input: { elapsed: 120 }
    }).start();
    actorRef2.send({ type: 'TIMER' });
    expect(actorRef2.getSnapshot().value).toEqual('yellow');
  });

  it('should transition if condition based on event is met', () => {
    const actorRef = createActor(lightMachine, { input: {} }).start();
    actorRef.send({
      type: 'EMERGENCY',
      isEmergency: true
    });
    expect(actorRef.getSnapshot().value).toEqual('red');
  });

  it('should not transition if condition based on event is not met', () => {
    const actorRef = createActor(lightMachine, { input: {} }).start();
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
    const actor = createActor(machine).start();
    flushTracked();

    actor.send({ type: 'TIMER', elapsed: 10 });

    expect(actor.getSnapshot().value).toBe('a');
    expect(flushTracked()).toEqual([]);
  });

  it('should work with defined string transitions', () => {
    const actorRef = createActor(lightMachine, {
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
    const actorRef = createActor(lightMachine, {
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
    const machine = createMachine(
      {
        types: {} as { context: LightMachineCtx; events: LightMachineEvents },
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

    const actorRef = createActor(machine).start();
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

    const errorSpy = jest.fn();

    const actorRef = createActor(machine);
    actorRef.subscribe({
      error: errorSpy
    });
    actorRef.start();

    actorRef.send({ type: 'BAD_COND' });

    expect(errorSpy).toMatchMockCallsInlineSnapshot(`
      [
        [
          [Error: Unable to evaluate guard 'doesNotExist' in transition for event 'BAD_COND' in state node '(machine).foo':
      Guard 'doesNotExist' is not implemented.'.],
        ],
      ]
    `);
  });

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

    const actorRef = createActor(machine).start();
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
                T2: {
                  fn: ({ value }) => {
                    if (matchesState('A.A2', value)) {
                      return { target: 'B2' };
                    }
                  }
                }
              }
            },
            B1: {},
            B2: {},
            B4: {}
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
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
              always: {
                fn: ({ value }) => {
                  if (matchesState('A.A4', value)) {
                    return { target: 'B4' };
                  }
                }
              }
            },
            B4: {}
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'A' });

    expect(actorRef.getSnapshot().value).toEqual({
      A: 'A5',
      B: 'B4'
    });
  });
});

describe('[function] guard conditions', () => {
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

  const minTimeElapsed = (elapsed: number) => elapsed >= 100 && elapsed < 200;

  const lightMachine = createMachine({
    types: {} as {
      input: { elapsed?: number };
      context: LightMachineCtx;
      events: LightMachineEvents;
    },
    context: ({ input = {} }) => ({
      elapsed: input.elapsed ?? 0
    }),
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: {
            fn: ({ context }) => {
              if (context.elapsed < 100) {
                return { target: 'green' };
              }
              if (context.elapsed >= 100 && context.elapsed < 200) {
                return { target: 'yellow' };
              }
            }
          },
          EMERGENCY: {
            fn: ({ event }) =>
              event.isEmergency ? { target: 'red' } : undefined
          }
        }
      },
      yellow: {
        on: {
          TIMER: {
            fn: ({ context }) =>
              minTimeElapsed(context.elapsed) ? { target: 'red' } : undefined
          },
          TIMER_COND_OBJ: {
            fn: ({ context }) =>
              minTimeElapsed(context.elapsed) ? { target: 'red' } : undefined
          }
        }
      },
      red: {}
    }
  });

  it('should transition only if condition is met', () => {
    const actorRef1 = createActor(lightMachine, {
      input: { elapsed: 50 }
    }).start();
    actorRef1.send({ type: 'TIMER' });
    expect(actorRef1.getSnapshot().value).toEqual('green');

    const actorRef2 = createActor(lightMachine, {
      input: { elapsed: 120 }
    }).start();
    actorRef2.send({ type: 'TIMER' });
    expect(actorRef2.getSnapshot().value).toEqual('yellow');
  });

  it('should transition if condition based on event is met', () => {
    const actorRef = createActor(lightMachine, { input: {} }).start();
    actorRef.send({
      type: 'EMERGENCY',
      isEmergency: true
    });
    expect(actorRef.getSnapshot().value).toEqual('red');
  });

  it('should not transition if condition based on event is not met', () => {
    const actorRef = createActor(lightMachine, { input: {} }).start();
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
            TIMER: {
              fn: ({ event }) => ({
                target:
                  event.elapsed > 200
                    ? 'b'
                    : event.elapsed > 100
                      ? 'c'
                      : undefined
              })
            }
          }
        },
        b: {},
        c: {}
      }
    });

    const flushTracked = trackEntries(machine);
    const actor = createActor(machine).start();
    flushTracked();

    actor.send({ type: 'TIMER', elapsed: 10 });

    expect(actor.getSnapshot().value).toBe('a');
    expect(flushTracked()).toEqual([]);
  });

  it('should work with defined string transitions', () => {
    const actorRef = createActor(lightMachine, {
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
    const actorRef = createActor(lightMachine, {
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
    const machine = createMachine({
      types: {} as { context: LightMachineCtx; events: LightMachineEvents },
      context: {
        elapsed: 10
      },
      initial: 'yellow',
      states: {
        green: {
          on: {
            TIMER: {
              fn: ({ context }) => ({
                target:
                  context.elapsed < 100
                    ? 'green'
                    : context.elapsed >= 100 && context.elapsed < 200
                      ? 'yellow'
                      : undefined
              })
            },
            EMERGENCY: {
              fn: ({ event }) => ({
                target: event.isEmergency ? 'red' : undefined
              })
            }
          }
        },
        yellow: {
          on: {
            TIMER: {
              fn: ({ context }) => ({
                target: minTimeElapsed(context.elapsed) ? 'red' : undefined
              })
            }
          }
        },
        red: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({
      type: 'TIMER'
    });

    expect(actorRef.getSnapshot().value).toEqual('yellow');
  });

  it.skip('should allow a matching transition', () => {
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
                    fn: ({ value }) => {
                      if (matchesState('A.A2', value)) {
                        return { target: 'B2' };
                      }
                    }
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

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'T2' });

    expect(actorRef.getSnapshot().value).toEqual({
      A: 'A2',
      B: 'B2'
    });
  });

  it.skip('should check guards with interim states', () => {
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
                  fn: ({ value }) => {
                    if (matchesState('A.A4', value)) {
                      return { target: 'B4' };
                    }
                  }
                }
              ]
            },
            B4: {}
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'A' });

    expect(actorRef.getSnapshot().value).toEqual({
      A: 'A5',
      B: 'B4'
    });
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
    const machine = createMachine(
      {
        types: {} as {
          context: Ctx;
          events: Events;
          guards: {
            type: 'custom';
            params: {
              prop: keyof Ctx;
              op: 'greaterThan';
              compare: number;
            };
          };
        },
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
          custom: ({ context, event }, params) => {
            const { prop, compare, op } = params;
            if (op === 'greaterThan') {
              return context[prop] + event.value > compare;
            }

            return false;
          }
        }
      }
    );

    const actorRef1 = createActor(machine).start();
    actorRef1.send({ type: 'EVENT', value: 4 });
    const passState = actorRef1.getSnapshot();

    expect(passState.value).toEqual('active');

    const actorRef2 = createActor(machine).start();
    actorRef2.send({ type: 'EVENT', value: 3 });
    const failState = actorRef2.getSnapshot();

    expect(failState.value).toEqual('inactive');
  });

  it('should provide the undefined params if a guard was configured using a string', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        on: {
          FOO: {
            guard: 'myGuard'
          }
        }
      },
      {
        guards: {
          myGuard: (_, params) => {
            spy(params);
            return true;
          }
        }
      }
    );

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'FOO' });

    expect(spy).toHaveBeenCalledWith(undefined);
  });

  it('should provide the guard with resolved params when they are dynamic', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        on: {
          FOO: {
            guard: { type: 'myGuard', params: () => ({ stuff: 100 }) }
          }
        }
      },
      {
        guards: {
          myGuard: (_, params) => {
            spy(params);
            return true;
          }
        }
      }
    );

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'FOO' });

    expect(spy).toHaveBeenCalledWith({
      stuff: 100
    });
  });

  it('should resolve dynamic params using context value', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        context: {
          secret: 42
        },
        on: {
          FOO: {
            guard: {
              type: 'myGuard',
              params: ({ context }) => ({ secret: context.secret })
            }
          }
        }
      },
      {
        guards: {
          myGuard: (_, params) => {
            spy(params);
            return true;
          }
        }
      }
    );

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'FOO' });

    expect(spy).toHaveBeenCalledWith({
      secret: 42
    });
  });

  it('should resolve dynamic params using event value', () => {
    const spy = jest.fn();

    const machine = createMachine(
      {
        on: {
          FOO: {
            guard: {
              type: 'myGuard',
              params: ({ event }) => ({ secret: event.secret })
            }
          }
        }
      },
      {
        guards: {
          myGuard: (_, params) => {
            spy(params);
            return true;
          }
        }
      }
    );

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'FOO', secret: 77 });

    expect(spy).toHaveBeenCalledWith({
      secret: 77
    });
  });
});

describe('guards - other', () => {
  it('should allow for a fallback target to be a simple string', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              fn: () => {
                return {
                  target: false ? 'b' : 'c'
                };
              }
            }
          }
        },
        b: {},
        c: {}
      }
    });

    const service = createActor(machine).start();
    service.send({ type: 'EVENT' });

    expect(service.getSnapshot().value).toBe('c');
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
              fn: () => {
                return {
                  target: !false ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();

    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with string', () => {
    const falsyGuard = () => false;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              fn: () => {
                return {
                  target: !falsyGuard() ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with object', () => {
    const greaterThan10 = (num: number) => num > 10;
    const machine = createMachine({
      types: {} as {
        guards: { type: 'greaterThan10'; params: { value: number } };
      },
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              fn: () => {
                return {
                  target: !greaterThan10(5) ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with nested built-in guards', () => {
    const truthy = () => true;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              fn: () => {
                return {
                  target: !(!truthy() && truthy()) ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should evaluate dynamic params of the referenced guard', () => {
    const spy = jest.fn();
    const myGuard = (params: any) => {
      spy(params);
      return true;
    };

    const machine = createMachine({
      on: {
        EV: {
          actions: () => {},
          fn: ({ event }) => {
            if (myGuard({ secret: event.secret })) {
              return {
                target: undefined
              };
            }
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EV', secret: 42 });

    expect(spy).toMatchMockCallsInlineSnapshot(`
[
  [
    {
      "secret": 42,
    },
  ],
  [
    {
      "secret": 42,
    },
  ],
  [
    {
      "secret": 42,
    },
  ],
  [
    {
      "secret": 42,
    },
  ],
  [
    {
      "secret": 42,
    },
  ],
  [
    {
      "secret": 42,
    },
  ],
  [
    {
      "secret": 42,
    },
  ],
]
`);
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
              fn: () => {
                return {
                  target: !(!true && 1 + 1 === 2) ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with string', () => {
    const truthy = () => true;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              fn: () => {
                return {
                  target: !(!truthy() && truthy()) ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with object', () => {
    const greaterThan10 = (num: number) => num > 10;
    const machine = createMachine({
      types: {} as {
        guards: {
          type: 'greaterThan10';
          params: { value: number };
        };
      },
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              fn: () => {
                return {
                  target: !(!greaterThan10(11) && greaterThan10(50))
                    ? 'b'
                    : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with nested built-in guards', () => {
    const truthy = () => true;
    const falsy = () => false;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              fn: () => {
                return {
                  target:
                    true && !falsy() && !falsy() && truthy() ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should evaluate dynamic params of the referenced guard', () => {
    const spy = jest.fn();

    const myGuard = (params: any) => {
      spy(params);
      return true;
    };

    const machine = createMachine({
      on: {
        EV: {
          fn: ({ event }) => {
            return {
              target:
                myGuard({ secret: event.secret }) && true ? 'b' : undefined
            };
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EV', secret: 42 });

    expect(spy).toMatchMockCallsInlineSnapshot(`
[
  [
    {
      "secret": 42,
    },
  ],
  [
    {
      "secret": 42,
    },
  ],
]
`);
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
              fn: () => {
                return {
                  target: false || 1 + 1 === 2 ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with string', () => {
    const falsy = () => false;
    const truthy = () => true;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              fn: () => {
                return {
                  target: falsy() || truthy() ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with object', () => {
    const greaterThan10 = (num: number) => num > 10;
    const machine = createMachine({
      types: {} as {
        guards: {
          type: 'greaterThan10';
          params: { value: number };
        };
      },
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              fn: () => {
                return {
                  target:
                    greaterThan10(4) || greaterThan10(50) ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should guard with nested built-in guards', () => {
    const truthy = () => true;
    const falsy = () => false;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              fn: () => {
                return {
                  target: falsy() || (!falsy() && truthy()) ? 'b' : undefined
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EVENT' });

    expect(actorRef.getSnapshot().matches('b')).toBeTruthy();
  });

  it('should evaluate dynamic params of the referenced guard', () => {
    const spy = jest.fn();

    const myGuard = (params: any) => {
      spy(params);
      return true;
    };

    const machine = createMachine({
      on: {
        EV: {
          fn: ({ event }) => {
            return {
              target:
                myGuard({ secret: event.secret }) || true ? 'b' : undefined
            };
          }
        }
      }
    });

    const actorRef = createActor(machine).start();
    actorRef.send({ type: 'EV', secret: 42 });

    expect(spy).toMatchMockCallsInlineSnapshot(`
[
  [
    {
      "secret": 42,
    },
  ],
  [
    {
      "secret": 42,
    },
  ],
]
`);
  });
});
