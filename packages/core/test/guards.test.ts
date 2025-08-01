import { createActor, matchesState, next_createMachine } from '../src/index.ts';
import { trackEntries } from './utils.ts';
import z from 'zod';

describe('guard conditions', () => {
  function minTimeElapsed(elapsed: number) {
    return elapsed >= 100 && elapsed < 200;
  }

  const lightMachine = next_createMachine({
    schemas: {
      input: z.object({
        elapsed: z.number().optional()
      }),
      context: z.object({
        elapsed: z.number()
      }),
      events: z.union([
        z.object({
          type: z.literal('TIMER')
        }),
        z.object({
          type: z.literal('EMERGENCY'),
          isEmergency: z.boolean()
        }),
        z.object({
          type: z.literal('TIMER_COND_OBJ')
        })
      ])
    },
    context: ({ input = {} }) => ({
      elapsed: input.elapsed ?? 0
    }),
    initial: 'green',
    states: {
      green: {
        on: {
          // TIMER: [
          //   {
          //     target: 'green',
          //     guard: ({ context: { elapsed } }) => elapsed < 100
          //   },
          //   {
          //     target: 'yellow',
          //     guard: ({ context: { elapsed } }) =>
          //       elapsed >= 100 && elapsed < 200
          //   }
          // ],
          TIMER: ({ context: { elapsed } }) => {
            if (elapsed < 100) {
              return { target: 'green' };
            }
            if (elapsed >= 100 && elapsed < 200) {
              return { target: 'yellow' };
            }
          },
          // EMERGENCY: {
          //   target: 'red',
          //   guard: ({ event }) => !!event.isEmergency
          // }
          EMERGENCY: ({ event }) => {
            if (event.isEmergency) {
              return { target: 'red' };
            }
          }
        }
      },
      yellow: {
        on: {
          // TIMER: {
          //   target: 'red',
          //   guard: 'minTimeElapsed'
          // },
          TIMER: ({ context: { elapsed } }) => {
            if (minTimeElapsed(elapsed)) {
              return { target: 'red' };
            }
          },
          // TIMER_COND_OBJ: {
          //   target: 'red',
          //   guard: {
          //     type: 'minTimeElapsed'
          //   }
          // }
          TIMER_COND_OBJ: ({ context: { elapsed } }) => {
            if (minTimeElapsed(elapsed)) {
              return { target: 'red' };
            }
          }
        }
      },
      red: {
        on: {
          // BAD_COND: {
          //   target: 'red',
          //   guard: 'doesNotExist'
          // }
        }
      }
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
      type: 'EMERGENCY',
      isEmergency: false
    });
    expect(actorRef.getSnapshot().value).toEqual('green');
  });

  it('should not transition if no condition is met', () => {
    const machine = next_createMachine({
      schemas: {
        events: z.object({
          type: z.literal('TIMER'),
          elapsed: z.number()
        })
      },
      initial: 'a',
      states: {
        a: {
          on: {
            // TIMER: [
            //   {
            //     target: 'b',
            //     guard: ({ event: { elapsed } }) => elapsed > 200
            //   },
            //   {
            //     target: 'c',
            //     guard: ({ event: { elapsed } }) => elapsed > 100
            //   }
            // ]
            TIMER: ({ event: { elapsed } }) => {
              if (elapsed > 200) {
                return { target: 'b' };
              }
              if (elapsed > 100) {
                return { target: 'c' };
              }
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
    const minTimeElapsed = (elapsed: number) => elapsed >= 100 && elapsed < 200;

    const machine = next_createMachine({
      // types: {} as { context: LightMachineCtx; events: LightMachineEvents },
      schemas: {
        context: z.object({
          elapsed: z.number()
        }),
        events: z.union([
          z.object({
            type: z.literal('TIMER')
          }),
          z.object({
            type: z.literal('EMERGENCY'),
            isEmergency: z.boolean()
          })
        ])
      },
      context: {
        elapsed: 10
      },
      initial: 'yellow',
      states: {
        green: {
          on: {
            // TIMER: [
            //   {
            //     target: 'green',
            //     guard: ({ context: { elapsed } }) => elapsed < 100
            //   },
            //   {
            //     target: 'yellow',
            //     guard: ({ context: { elapsed } }) =>
            //       elapsed >= 100 && elapsed < 200
            //   }
            // ],
            TIMER: ({ context: { elapsed } }) => {
              if (elapsed < 100) {
                return { target: 'green' };
              }
              if (elapsed >= 100 && elapsed < 200) {
                return { target: 'yellow' };
              }
            },
            // EMERGENCY: {
            //   target: 'red',
            //   guard: ({ event }) => !!event.isEmergency
            // }
            EMERGENCY: ({ event }) => {
              if (event.isEmergency) {
                return { target: 'red' };
              }
            }
          }
        },
        yellow: {
          on: {
            // TIMER: {
            //   target: 'red',
            //   guard: 'minTimeElapsed'
            // }
            TIMER: ({ context: { elapsed } }) => {
              if (minTimeElapsed(elapsed)) {
                return { target: 'red' };
              }
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

  it('should guard against transition', () => {
    const machine = next_createMachine({
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
              // always: [
              //   {
              //     target: 'B4',
              //     guard: () => false
              //   }
              // ],
              always: () => {
                if (1 + 1 !== 2) {
                  return { target: 'B4' };
                }
              },
              on: {
                // T1: [
                //   {
                //     target: 'B1',
                //     guard: () => false
                //   }
                // ]
                T1: () => {
                  if (1 + 1 !== 2) {
                    return { target: 'B1' };
                  }
                }
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
    const machine = next_createMachine({
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
              // always: [
              //   {
              //     target: 'B4',
              //     guard: () => false
              //   }
              // ],
              always: () => {
                if (1 + 1 !== 2) {
                  return { target: 'B4' };
                }
              },
              on: {
                // T2: [
                //   {
                //     target: 'B2',
                //     guard: stateIn('A.A2')
                //   }
                // ]
                T2: ({ value }) => {
                  if (matchesState('A.A2', value)) {
                    return { target: 'B2' };
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
    const machine = next_createMachine({
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
              // always: [
              //   {
              //     target: 'B4',
              //     guard: stateIn('A.A4')
              //   }
              // ]
              always: ({ value }) => {
                if (matchesState('A.A4', value)) {
                  return { target: 'B4' };
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
  const minTimeElapsed = (elapsed: number) => elapsed >= 100 && elapsed < 200;

  const lightMachine = next_createMachine({
    // types: {} as {
    //   input: { elapsed?: number };
    //   context: LightMachineCtx;
    //   events: LightMachineEvents;
    // },
    schemas: {
      input: z.object({
        elapsed: z.number().optional()
      }),
      context: z.object({
        elapsed: z.number()
      }),
      events: z.union([
        z.object({
          type: z.literal('TIMER')
        }),
        z.object({
          type: z.literal('TIMER_COND_OBJ')
        }),
        z.object({
          type: z.literal('EMERGENCY'),
          isEmergency: z.boolean()
        })
      ])
    },
    context: ({ input = {} }) => ({
      elapsed: input.elapsed ?? 0
    }),
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: ({ context }) => {
            if (context.elapsed < 100) {
              return { target: 'green' };
            }
            if (context.elapsed >= 100 && context.elapsed < 200) {
              return { target: 'yellow' };
            }
          },
          EMERGENCY: ({ event }) =>
            event.isEmergency ? { target: 'red' } : undefined
        }
      },
      yellow: {
        on: {
          TIMER: ({ context }) =>
            minTimeElapsed(context.elapsed) ? { target: 'red' } : undefined,

          TIMER_COND_OBJ: ({ context }) =>
            minTimeElapsed(context.elapsed) ? { target: 'red' } : undefined
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
      type: 'EMERGENCY',
      isEmergency: false
    });
    expect(actorRef.getSnapshot().value).toEqual('green');
  });

  it('should not transition if no condition is met', () => {
    const machine = next_createMachine({
      schemas: {
        events: z.object({
          type: z.literal('TIMER'),
          elapsed: z.number()
        })
      },
      initial: 'a',
      states: {
        a: {
          on: {
            TIMER: ({ event }) => ({
              target:
                event.elapsed > 200
                  ? 'b'
                  : event.elapsed > 100
                    ? 'c'
                    : undefined
            })
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
    const machine = next_createMachine({
      // types: {} as { context: LightMachineCtx; events: LightMachineEvents },
      schemas: {
        context: z.object({
          elapsed: z.number()
        }),
        events: z.union([
          z.object({
            type: z.literal('TIMER')
          }),
          z.object({
            type: z.literal('EMERGENCY'),
            isEmergency: z.boolean()
          })
        ])
      },
      context: {
        elapsed: 10
      },
      initial: 'yellow',
      states: {
        green: {
          on: {
            TIMER: ({ context }) => ({
              target:
                context.elapsed < 100
                  ? 'green'
                  : context.elapsed >= 100 && context.elapsed < 200
                    ? 'yellow'
                    : undefined
            }),
            EMERGENCY: ({ event }) => ({
              target: event.isEmergency ? 'red' : undefined
            })
          }
        },
        yellow: {
          on: {
            TIMER: ({ context }) => ({
              target: minTimeElapsed(context.elapsed) ? 'red' : undefined
            })
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
    const machine = next_createMachine({
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
              // always: [
              //   {
              //     target: 'B4',
              //     guard: () => false
              //   }
              // ],
              always: () => {
                if (1 + 1 !== 2) {
                  return { target: 'B4' };
                }
              },
              on: {
                // T2: [
                //   {
                //     target: 'B2',
                //     guard: stateIn('A.A2')
                //   }
                // ]
                T2: ({ value }) => {
                  if (matchesState('A.A2', value)) {
                    return { target: 'B2' };
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

  it.skip('should check guards with interim states', () => {
    const machine = next_createMachine({
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
              // always: [
              //   {
              //     target: 'B4',
              //     guard: stateIn('A.A4')
              //   }
              // ]
              always: ({ value }) => {
                if (matchesState('A.A4', value)) {
                  return { target: 'B4' };
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

describe('custom guards', () => {
  it('should evaluate custom guards', () => {
    const contextSchema = z.object({
      count: z.number()
    });
    const eventSchema = z.object({
      type: z.literal('EVENT'),
      value: z.number()
    });

    function customGuard(
      context: z.infer<typeof contextSchema>,
      event: z.infer<typeof eventSchema>,
      params: {
        prop: keyof z.infer<typeof contextSchema>;
        op: 'greaterThan';
        compare: number;
      }
    ) {
      const { prop, compare, op } = params;
      if (op === 'greaterThan') {
        return context[prop] + event.value > compare;
      }

      return false;
    }
    const machine = next_createMachine({
      // types: {} as {
      //   context: Ctx;
      //   events: Events;
      //   guards: {
      //     type: 'custom';
      //     params: {
      //       prop: keyof Ctx;
      //       op: 'greaterThan';
      //       compare: number;
      //     };
      //   };
      // },
      schemas: {
        context: contextSchema,
        events: eventSchema
      },
      initial: 'inactive',
      context: {
        count: 0
      },
      states: {
        inactive: {
          on: {
            // EVENT: {
            //   target: 'active',
            //   guard: {
            //     type: 'custom',
            //     params: { prop: 'count', op: 'greaterThan', compare: 3 }
            //   }
            // }
            EVENT: ({ context, event }) => {
              if (
                customGuard(context, event, {
                  prop: 'count',
                  op: 'greaterThan',
                  compare: 3
                })
              ) {
                return { target: 'active' };
              }
            }
          }
        },
        active: {}
      }
    });

    const actorRef1 = createActor(machine).start();
    actorRef1.send({ type: 'EVENT', value: 4 });
    const passState = actorRef1.getSnapshot();

    expect(passState.value).toEqual('active');

    const actorRef2 = createActor(machine).start();
    actorRef2.send({ type: 'EVENT', value: 3 });
    const failState = actorRef2.getSnapshot();

    expect(failState.value).toEqual('inactive');
  });
});

describe('guards - other', () => {
  it('should allow for a fallback target to be a simple string', () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            // EVENT: [{ target: 'b', guard: () => false }, 'c']
            EVENT: () => {
              if (1 + 1 !== 2) {
                return { target: 'b' };
              }
              return { target: 'c' };
            }
          }
        },
        b: {},
        c: {}
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'EVENT' });

    expect(actor.getSnapshot().value).toBe('c');
  });
});
