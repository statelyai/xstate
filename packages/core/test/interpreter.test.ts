import { SimulatedClock } from '../src/SimulatedClock';
import {
  createActor,
  StateValue,
  next_createMachine,
  ActorRefFrom
} from '../src/index.ts';
import { interval, from } from 'rxjs';
import { fromObservable } from '../src/actors/observable';
import { PromiseActorLogic, fromPromise } from '../src/actors/promise';
import { fromCallback } from '../src/actors/callback';
import { assertEvent } from '../src/assert.ts';
import z from 'zod';

const lightMachine = next_createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      entry: (_, enq) => {
        enq.raise({ type: 'TIMER' }, { id: 'TIMER1', delay: 10 });
      },
      on: {
        TIMER: 'yellow',
        KEEP_GOING: (_, enq) => {
          enq.cancel('TIMER1');
        }
      }
    },
    yellow: {
      entry: (_, enq) => {
        enq.raise({ type: 'TIMER' }, { delay: 10 });
      },
      on: {
        TIMER: 'red'
      }
    },
    red: {
      after: {
        10: 'green'
      }
    }
  }
});

describe('interpreter', () => {
  describe('initial state', () => {
    it('.getSnapshot returns the initial state', () => {
      const machine = next_createMachine({
        initial: 'foo',
        states: {
          bar: {},
          foo: {}
        }
      });
      const service = createActor(machine);

      expect(service.getSnapshot().value).toEqual('foo');
    });

    it('initially spawned actors should not be spawned when reading initial state', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      let promiseSpawned = 0;

      const machine = next_createMachine({
        initial: 'idle',
        schemas: {
          context: z.object({
            actor: z.any()
          })
        },
        context: {
          actor: undefined! as ActorRefFrom<PromiseActorLogic<unknown>>
        },
        states: {
          idle: {
            // entry: assign({
            //   actor: ({ spawn }) => {
            //     return spawn(
            //       fromPromise(
            //         () =>
            //           new Promise(() => {
            //             promiseSpawned++;
            //           })
            //       )
            //     );
            //   }
            // })
            entry: (_, enq) => ({
              context: {
                actor: enq.spawn(
                  fromPromise(
                    () =>
                      new Promise(() => {
                        promiseSpawned++;
                      })
                  )
                )
              }
            })
          }
        }
      });

      const service = createActor(machine);

      expect(promiseSpawned).toEqual(0);

      service.getSnapshot();
      service.getSnapshot();
      service.getSnapshot();

      expect(promiseSpawned).toEqual(0);

      service.start();

      setTimeout(() => {
        expect(promiseSpawned).toEqual(1);
        resolve();
      }, 100);
      return promise;
    });

    it('does not execute actions from a restored state', () => {
      let called = false;
      const machine = next_createMachine({
        initial: 'green',
        states: {
          green: {
            on: {
              // TIMER: {
              //   target: 'yellow',
              //   actions: () => (called = true)
              // }
              TIMER: (_, enq) => {
                enq.action(() => {
                  called = true;
                });
                return { target: 'yellow' };
              }
            }
          },
          yellow: {
            on: {
              TIMER: {
                target: 'red'
              }
            }
          },
          red: {
            on: {
              TIMER: 'green'
            }
          }
        }
      });

      let actorRef = createActor(machine).start();

      actorRef.send({ type: 'TIMER' });
      called = false;
      const persisted = actorRef.getPersistedSnapshot();
      actorRef = createActor(machine, { snapshot: persisted }).start();

      expect(called).toBe(false);
    });

    it('should not execute actions that are not part of the actual persisted state', () => {
      let called = false;
      const machine = next_createMachine({
        initial: 'a',
        states: {
          a: {
            entry: (_, enq) => {
              // this should not be called when starting from a different state
              enq.action(() => {
                called = true;
              });
            },
            always: 'b'
          },
          b: {}
        }
      });

      const actorRef = createActor(machine).start();
      called = false;
      expect(actorRef.getSnapshot().value).toEqual('b');
      const persisted = actorRef.getPersistedSnapshot();

      createActor(machine, { snapshot: persisted }).start();

      expect(called).toBe(false);
    });
  });

  describe('subscribing', () => {
    const machine = next_createMachine({
      initial: 'active',
      states: {
        active: {}
      }
    });

    it('should not notify subscribers of the current state upon subscription (subscribe)', () => {
      const spy = vi.fn();
      const service = createActor(machine).start();

      service.subscribe(spy);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('send with delay', () => {
    it('can send an event after a delay', async () => {
      const machine = next_createMachine({
        initial: 'foo',
        states: {
          foo: {
            // entry: [raise({ type: 'TIMER' }, { delay: 10 })],
            entry: (_, enq) => {
              enq.raise({ type: 'TIMER' }, { delay: 10 });
            },
            on: {
              TIMER: 'bar'
            }
          },
          bar: {}
        }
      });
      const actorRef = createActor(machine);
      expect(actorRef.getSnapshot().value).toBe('foo');

      await new Promise((res) => setTimeout(res, 10));
      expect(actorRef.getSnapshot().value).toBe('foo');

      actorRef.start();
      expect(actorRef.getSnapshot().value).toBe('foo');

      await new Promise((res) => setTimeout(res, 5));
      expect(actorRef.getSnapshot().value).toBe('foo');

      await new Promise((res) => setTimeout(res, 10));
      expect(actorRef.getSnapshot().value).toBe('bar');
    });

    it('can send an event after a delay (expression)', () => {
      interface DelayExprMachineCtx {
        initialDelay: number;
      }

      type DelayExpMachineEvents =
        | { type: 'ACTIVATE'; wait: number }
        | { type: 'FINISH' };

      const delayExprMachine = next_createMachine({
        // types: {} as {
        //   context: DelayExprMachineCtx;
        //   events: DelayExpMachineEvents;
        // },
        schemas: {
          context: z.object({
            initialDelay: z.number()
          }),
          events: z.union([
            z.object({
              type: z.literal('ACTIVATE'),
              wait: z.number()
            }),
            z.object({
              type: z.literal('FINISH')
            })
          ])
        },
        id: 'delayExpr',
        context: {
          initialDelay: 100
        },
        initial: 'idle',
        states: {
          idle: {
            on: {
              ACTIVATE: 'pending'
            }
          },
          pending: {
            // entry: raise(
            //   { type: 'FINISH' },
            //   {
            //     delay: ({ context, event }) =>
            //       context.initialDelay + ('wait' in event ? event.wait : 0)
            //   }
            // ),
            entry: ({ context, event }, enq) => {
              enq.raise(
                { type: 'FINISH' },
                {
                  delay:
                    context.initialDelay + ('wait' in event ? event.wait : 0)
                }
              );
            },
            on: {
              FINISH: 'finished'
            }
          },
          finished: { type: 'final' }
        }
      });

      let stopped = false;

      const clock = new SimulatedClock();

      const delayExprService = createActor(delayExprMachine, {
        clock
      });
      delayExprService.subscribe({
        complete: () => {
          stopped = true;
        }
      });
      delayExprService.start();

      delayExprService.send({
        type: 'ACTIVATE',
        wait: 50
      });

      clock.increment(101);

      expect(stopped).toBe(false);

      clock.increment(50);

      expect(stopped).toBe(true);
    });

    it('can send an event after a delay (expression using _event)', () => {
      interface DelayExprMachineCtx {
        initialDelay: number;
      }

      type DelayExpMachineEvents =
        | {
            type: 'ACTIVATE';
            wait: number;
          }
        | {
            type: 'FINISH';
          };

      const delayExprMachine = next_createMachine({
        // types: {} as {
        //   context: DelayExprMachineCtx;
        //   events: DelayExpMachineEvents;
        // },
        schemas: {
          context: z.object({
            initialDelay: z.number()
          }),
          events: z.union([
            z.object({
              type: z.literal('ACTIVATE'),
              wait: z.number()
            }),
            z.object({
              type: z.literal('FINISH')
            })
          ])
        },
        id: 'delayExpr',
        context: {
          initialDelay: 100
        },
        initial: 'idle',
        states: {
          idle: {
            on: {
              ACTIVATE: 'pending'
            }
          },
          pending: {
            // entry: raise(
            //   { type: 'FINISH' },
            //   {
            //     delay: ({ context, event }) => {
            //       assertEvent(event, 'ACTIVATE');
            //       return context.initialDelay + event.wait;
            //     }
            //   }
            // ),
            entry: ({ context, event }, enq) => {
              assertEvent(event, 'ACTIVATE');
              enq.raise(
                { type: 'FINISH' },
                {
                  delay: context.initialDelay + event.wait
                }
              );
            },
            on: {
              FINISH: 'finished'
            }
          },
          finished: {
            type: 'final'
          }
        }
      });

      let stopped = false;

      const clock = new SimulatedClock();

      const delayExprService = createActor(delayExprMachine, {
        clock
      });
      delayExprService.subscribe({
        complete: () => {
          stopped = true;
        }
      });
      delayExprService.start();

      delayExprService.send({
        type: 'ACTIVATE',
        wait: 50
      });

      clock.increment(101);

      expect(stopped).toBe(false);

      clock.increment(50);

      expect(stopped).toBe(true);
    });

    it('can send an event after a delay (delayed transitions)', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const clock = new SimulatedClock();
      const letterMachine = next_createMachine(
        {
          // types: {} as {
          //   events: { type: 'FIRE_DELAY'; value: number };
          // },
          schemas: {
            events: z.object({
              type: z.literal('FIRE_DELAY'),
              value: z.number()
            })
          },
          delays: {
            someDelay: ({ context }) => context.delay + 50,
            delayA: ({ context }) => context.delay,
            delayD: ({ context, event }) => context.delay + event.value
          },
          id: 'letter',
          context: {
            delay: 100
          },
          initial: 'a',
          states: {
            a: {
              after: {
                delayA: 'b'
              }
            },
            b: {
              after: {
                someDelay: 'c'
              }
            },
            c: {
              // entry: raise({ type: 'FIRE_DELAY', value: 200 }, { delay: 20 }),
              entry: (_, enq) => {
                enq.raise({ type: 'FIRE_DELAY', value: 200 }, { delay: 20 });
              },
              on: {
                FIRE_DELAY: 'd'
              }
            },
            d: {
              after: {
                delayD: 'e'
              }
            },
            e: {
              after: { someDelay: 'f' }
            },
            f: {
              type: 'final'
            }
          }
        }
        // {
        //   delays: {
        //     someDelay: ({ context }) => {
        //       return context.delay + 50;
        //     },
        //     delayA: ({ context }) => context.delay,
        //     delayD: ({ context, event }) => context.delay + event.value
        //   }
        // }
      );

      const actor = createActor(letterMachine, { clock });
      actor.subscribe({
        complete: () => {
          resolve();
        }
      });
      actor.start();

      expect(actor.getSnapshot().value).toEqual('a');
      clock.increment(100);
      expect(actor.getSnapshot().value).toEqual('b');
      clock.increment(100 + 50);
      expect(actor.getSnapshot().value).toEqual('c');
      clock.increment(20);
      expect(actor.getSnapshot().value).toEqual('d');
      clock.increment(100 + 200);
      expect(actor.getSnapshot().value).toEqual('e');
      clock.increment(100 + 50);

      return promise;
    });
  });

  describe('activities (deprecated)', () => {
    it('should start activities', () => {
      const spy = vi.fn();

      const activityMachine = next_createMachine(
        {
          id: 'activity',
          initial: 'on',
          states: {
            on: {
              invoke: {
                src: fromCallback(spy)
              },
              on: {
                TURN_OFF: 'off'
              }
            },
            off: {}
          }
        }
        // {
        //   actors: {
        //     myActivity: fromCallback(spy)
        //   }
        // }
      );
      const service = createActor(activityMachine);

      service.start();

      expect(spy).toHaveBeenCalled();
    });

    it('should stop activities', () => {
      const spy = vi.fn();

      const activityMachine = next_createMachine(
        {
          id: 'activity',
          initial: 'on',
          states: {
            on: {
              invoke: {
                src: fromCallback(() => spy)
              },
              on: {
                TURN_OFF: 'off'
              }
            },
            off: {}
          }
        }
        // {
        //   actors: {
        //     myActivity: fromCallback(() => spy)
        //   }
        // }
      );
      const service = createActor(activityMachine);

      service.start();

      expect(spy).not.toHaveBeenCalled();

      service.send({ type: 'TURN_OFF' });

      expect(spy).toHaveBeenCalled();
    });

    it('should stop activities upon stopping the service', () => {
      const spy = vi.fn();

      const stopActivityMachine = next_createMachine(
        {
          id: 'stopActivity',
          initial: 'on',
          states: {
            on: {
              invoke: {
                src: fromCallback(() => spy)
              },
              on: {
                TURN_OFF: 'off'
              }
            },
            off: {}
          }
        }
        // {
        //   actors: {
        //     myActivity: fromCallback(() => spy)
        //   }
        // }
      );

      const stopActivityService = createActor(stopActivityMachine).start();

      expect(spy).not.toHaveBeenCalled();

      stopActivityService.stop();

      expect(spy).toHaveBeenCalled();
    });

    it('should restart activities from a compound state', () => {
      let activityActive = false;

      const machine = next_createMachine(
        {
          initial: 'inactive',
          states: {
            inactive: {
              on: { TOGGLE: 'active' }
            },
            active: {
              invoke: {
                src: fromCallback(() => {
                  activityActive = true;
                  return () => {
                    activityActive = false;
                  };
                })
              },
              on: { TOGGLE: 'inactive' },
              initial: 'A',
              states: {
                A: { on: { SWITCH: 'B' } },
                B: { on: { SWITCH: 'A' } }
              }
            }
          }
        }
        // {
        //   actors: {
        //     blink: fromCallback(() => {
        //       activityActive = true;
        //       return () => {
        //         activityActive = false;
        //       };
        //     })
        //   }
        // }
      );

      const actorRef = createActor(machine).start();
      actorRef.send({ type: 'TOGGLE' });
      actorRef.send({ type: 'SWITCH' });
      const bState = actorRef.getPersistedSnapshot();
      actorRef.stop();
      activityActive = false;

      createActor(machine, { snapshot: bState }).start();

      expect(activityActive).toBeTruthy();
    });
  });

  it('can cancel a delayed event', () => {
    const service = createActor(lightMachine, {
      clock: new SimulatedClock()
    });
    const clock = service.clock as SimulatedClock;
    service.start();

    clock.increment(5);
    service.send({ type: 'KEEP_GOING' });

    expect(service.getSnapshot().value).toEqual('green');
    clock.increment(10);
    expect(service.getSnapshot().value).toEqual('green');
  });

  it('can cancel a delayed event using expression to resolve send id', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'first',
      states: {
        first: {
          // entry: [
          //   raise(
          //     { type: 'FOO' },
          //     {
          //       id: 'foo',
          //       delay: 100
          //     }
          //   ),
          //   raise(
          //     { type: 'BAR' },
          //     {
          //       delay: 200
          //     }
          //   ),
          //   cancel(() => 'foo')
          // ],
          entry: (_, enq) => {
            enq.raise({ type: 'FOO' }, { id: 'foo', delay: 100 });
            enq.raise({ type: 'BAR' }, { delay: 200 });
            enq.cancel('foo');
          },
          on: {
            FOO: 'fail',
            BAR: 'pass'
          }
        },
        fail: {
          type: 'final'
        },
        pass: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();

    service.subscribe({
      complete: () => {
        expect(service.getSnapshot().value).toBe('pass');
        resolve();
      }
    });
    return promise;
  });

  it('should not throw an error if an event is sent to an uninitialized interpreter', () => {
    const actorRef = createActor(lightMachine);

    expect(() => actorRef.send({ type: 'SOME_EVENT' })).not.toThrow();
  });

  it('should defer events sent to an uninitialized service', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const deferMachine = next_createMachine({
      id: 'defer',
      initial: 'a',
      states: {
        a: {
          on: { NEXT_A: 'b' }
        },
        b: {
          on: { NEXT_B: 'c' }
        },
        c: {
          type: 'final'
        }
      }
    });

    let state: any;
    const deferService = createActor(deferMachine);

    deferService.subscribe({
      next: (nextState) => {
        state = nextState;
      },
      complete: resolve
    });

    // uninitialized
    deferService.send({ type: 'NEXT_A' });
    deferService.send({ type: 'NEXT_B' });

    expect(state).not.toBeDefined();

    // initialized
    deferService.start();
    return promise;
  });

  it('should throw an error if initial state sent to interpreter is invalid', () => {
    const invalidMachine = {
      id: 'fetchMachine',
      initial: 'create',
      states: {
        edit: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                FETCH: 'pending'
              }
            },
            pending: {}
          }
        }
      }
    };

    const snapshot = createActor(
      next_createMachine(invalidMachine)
    ).getSnapshot();

    expect(snapshot.status).toBe('error');
    expect(snapshot.error).toMatchInlineSnapshot(
      `[Error: Initial state node "create" not found on parent state node #fetchMachine]`
    );
  });

  it('should not update when stopped', () => {
    const warnSpy = vi.spyOn(console, 'warn');
    const service = createActor(lightMachine, {
      clock: new SimulatedClock()
    });

    service.start();
    service.send({ type: 'TIMER' }); // yellow
    expect(service.getSnapshot().value).toEqual('yellow');

    service.stop();
    try {
      service.send({ type: 'TIMER' }); // red if interpreter is not stopped
    } catch (e) {
      expect(service.getSnapshot().value).toEqual('yellow');
    }

    expect(warnSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "Event "TIMER" was sent to stopped actor "x:0 (x:0)". This actor has already reached its final state, and will not transition.
      Event: {"type":"TIMER"}",
        ],
      ]
    `);
  });

  it('should be able to log (log action)', () => {
    const logs: any[] = [];

    const logMachine = next_createMachine({
      // types: {} as { context: { count: number } },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      id: 'log',
      initial: 'x',
      context: { count: 0 },
      states: {
        x: {
          on: {
            LOG: ({ context }, enq) => {
              const nextContext = {
                count: context.count + 1
              };
              enq.log(nextContext);
              return {
                context: nextContext
              };
            }
          }
        }
      }
    });

    const service = createActor(logMachine, {
      logger: (msg) => logs.push(msg)
    }).start();

    service.send({ type: 'LOG' });
    service.send({ type: 'LOG' });

    expect(logs.length).toBe(2);
    expect(logs).toEqual([{ count: 1 }, { count: 2 }]);
  });

  it('should receive correct event (log action)', () => {
    const logs: any[] = [];

    const parentMachine = next_createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            // EXTERNAL_EVENT: {
            //   actions: [raise({ type: 'RAISED_EVENT' }), logAction]
            // }
            EXTERNAL_EVENT: ({ event }, enq) => {
              enq.raise({ type: 'RAISED_EVENT' });
              enq.log(event.type);
            }
          }
        }
      },
      on: {
        // '*': {
        //   actions: [logAction]
        // }
        '*': ({ event }, enq) => {
          enq.log(event.type);
        }
      }
    });

    const service = createActor(parentMachine, {
      logger: (msg) => logs.push(msg)
    }).start();

    service.send({ type: 'EXTERNAL_EVENT' });

    expect(logs.length).toBe(2);
    expect(logs).toEqual(['EXTERNAL_EVENT', 'RAISED_EVENT']);
  });

  describe('send() event expressions', () => {
    const machine = next_createMachine({
      // types: {} as { context: Ctx; events: Events },
      schemas: {
        context: z.object({
          password: z.string()
        }),
        events: z.object({
          type: z.literal('NEXT'),
          password: z.string()
        })
      },
      id: 'sendexpr',
      initial: 'start',
      context: {
        password: 'foo'
      },
      states: {
        start: {
          // entry: raise(({ context }) => ({
          //   type: 'NEXT' as const,
          //   password: context.password
          // })),
          entry: ({ context }, enq) => {
            enq.raise({
              type: 'NEXT' as const,
              password: context.password
            });
          },
          on: {
            // NEXT: {
            //   target: 'finish',
            //   guard: ({ event }) => event.password === 'foo'
            // }
            NEXT: ({ event }) => {
              if (event.password === 'foo') {
                return { target: 'finish' };
              }
            }
          }
        },
        finish: {
          type: 'final'
        }
      }
    });

    it('should resolve send event expressions', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const actor = createActor(machine);
      actor.subscribe({ complete: () => resolve() });
      actor.start();
      return promise;
    });
  });

  describe('sendParent() event expressions', () => {
    it('should resolve sendParent event expressions', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const childMachine = next_createMachine({
        // types: {} as {
        //   context: { password: string };
        //   input: { password: string };
        // },
        schemas: {
          context: z.object({
            password: z.string()
          }),
          input: z.object({
            password: z.string()
          })
        },
        id: 'child',
        initial: 'start',
        context: ({ input }) => ({
          password: input.password
        }),
        states: {
          start: {
            // entry: sendParent(({ context }) => {
            //   return { type: 'NEXT', password: context.password };
            // })
            entry: ({ context, parent }, enq) => {
              enq.sendTo(parent, {
                type: 'NEXT',
                password: context.password
              });
            }
          }
        }
      });

      const parentMachine = next_createMachine({
        // types: {} as {
        //   events: {
        //     type: 'NEXT';
        //     password: string;
        //   };
        // },
        schemas: {
          events: z.object({
            type: z.literal('NEXT'),
            password: z.string()
          })
        },
        id: 'parent',
        initial: 'start',
        states: {
          start: {
            invoke: {
              id: 'child',
              src: childMachine,
              input: { password: 'foo' }
            },
            on: {
              // NEXT: {
              //   target: 'finish',
              //   guard: ({ event }) => event.password === 'foo'
              // }
              NEXT: ({ event }) => {
                if (event.password === 'foo') {
                  return { target: 'finish' };
                }
              }
            }
          },
          finish: {
            type: 'final'
          }
        }
      });

      const actor = createActor(parentMachine);
      actor.subscribe({
        next: (state) => {
          if (state.matches('start')) {
            const childActor = state.children.child;

            expect(typeof childActor!.send).toBe('function');
          }
        },
        complete: () => resolve()
      });
      actor.start();
      return promise;
    });
  });

  describe('.send()', () => {
    const sendMachine = next_createMachine({
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('EVENT'),
            id: z.number()
          }),
          z.object({
            type: z.literal('ACTIVATE')
          })
        ])
      },
      id: 'send',
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            // EVENT: {
            //   target: 'active',
            //   guard: ({ event }) => event.id === 42 // TODO: fix unknown event type
            // },
            EVENT: ({ event }) => {
              if (event.id === 42) {
                return { target: 'active' };
              }
            },
            ACTIVATE: 'active'
          }
        },
        active: {
          type: 'final'
        }
      }
    });

    it('can send events with a string', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const service = createActor(sendMachine);
      service.subscribe({ complete: () => resolve() });
      service.start();

      service.send({ type: 'ACTIVATE' });
      return promise;
    });

    it('can send events with an object', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const service = createActor(sendMachine);
      service.subscribe({ complete: () => resolve() });
      service.start();

      service.send({ type: 'ACTIVATE' });
      return promise;
    });

    it('can send events with an object with payload', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const service = createActor(sendMachine);
      service.subscribe({ complete: () => resolve() });
      service.start();

      service.send({ type: 'EVENT', id: 42 });
      return promise;
    });

    it('should receive and process all events sent simultaneously', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const toggleMachine = next_createMachine({
        id: 'toggle',
        initial: 'inactive',
        states: {
          fail: {},
          inactive: {
            on: {
              INACTIVATE: 'fail',
              ACTIVATE: 'active'
            }
          },
          active: {
            on: {
              INACTIVATE: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const toggleService = createActor(toggleMachine);
      toggleService.subscribe({
        complete: () => {
          resolve();
        }
      });
      toggleService.start();

      toggleService.send({ type: 'ACTIVATE' });
      toggleService.send({ type: 'INACTIVATE' });
      return promise;
    });
  });

  describe('.start()', () => {
    it('should initialize the service', () => {
      const contextSpy = vi.fn();
      const entrySpy = vi.fn();

      const machine = next_createMachine({
        context: contextSpy,
        entry: entrySpy,
        initial: 'foo',
        states: {
          foo: {}
        }
      });
      const actor = createActor(machine);
      actor.start();

      expect(contextSpy).toHaveBeenCalled();
      expect(entrySpy).toHaveBeenCalled();
      expect(actor.getSnapshot()).toBeDefined();
      expect(actor.getSnapshot().matches('foo')).toBeTruthy();
    });

    it('should not reinitialize a started service', () => {
      const contextSpy = vi.fn();
      const entrySpy = vi.fn();

      const machine = next_createMachine({
        context: contextSpy,
        entry: entrySpy
      });
      const actor = createActor(machine);
      actor.start();
      actor.start();

      expect(contextSpy).toHaveBeenCalledTimes(1);
      expect(entrySpy).toHaveBeenCalledTimes(1);
    });

    it('should be able to be initialized at a custom state', () => {
      const machine = next_createMachine({
        initial: 'foo',
        states: {
          foo: {},
          bar: {}
        }
      });
      const actor = createActor(machine, {
        snapshot: machine.resolveState({ value: 'bar' })
      });

      expect(actor.getSnapshot().matches('bar')).toBeTruthy();
      actor.start();
      expect(actor.getSnapshot().matches('bar')).toBeTruthy();
    });

    it('should be able to be initialized at a custom state value', () => {
      const machine = next_createMachine({
        initial: 'foo',
        states: {
          foo: {},
          bar: {}
        }
      });
      const actor = createActor(machine, {
        snapshot: machine.resolveState({ value: 'bar' })
      });

      expect(actor.getSnapshot().matches('bar')).toBeTruthy();
      actor.start();
      expect(actor.getSnapshot().matches('bar')).toBeTruthy();
    });

    it('should be able to resolve a custom initialized state', () => {
      const machine = next_createMachine({
        id: 'start',
        initial: 'foo',
        states: {
          foo: {
            initial: 'one',
            states: {
              one: {}
            }
          },
          bar: {}
        }
      });
      const actor = createActor(machine, {
        snapshot: machine.resolveState({ value: 'foo' })
      });

      expect(actor.getSnapshot().matches({ foo: 'one' })).toBeTruthy();
      actor.start();
      expect(actor.getSnapshot().matches({ foo: 'one' })).toBeTruthy();
    });
  });

  describe('.stop()', () => {
    it('should cancel delayed events', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      let called = false;
      const delayedMachine = next_createMachine({
        id: 'delayed',
        initial: 'foo',
        states: {
          foo: {
            after: {
              // 50: {
              //   target: 'bar',
              //   actions: () => {
              //     called = true;
              //   }
              // }
              50: (_, enq) => {
                enq.action(() => {
                  called = true;
                });
                return { target: 'bar' };
              }
            }
          },
          bar: {}
        }
      });

      const delayedService = createActor(delayedMachine).start();

      delayedService.stop();

      setTimeout(() => {
        expect(called).toBe(false);
        resolve();
      }, 60);
      return promise;
    });

    it('should not execute transitions after being stopped', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const warnSpy = vi.spyOn(console, 'warn');
      let called = false;

      const testMachine = next_createMachine({
        initial: 'waiting',
        states: {
          waiting: {
            on: {
              TRIGGER: 'active'
            }
          },
          active: {
            entry: (_, enq) => {
              enq.action(() => {
                called = true;
              });
            }
          }
        }
      });

      const service = createActor(testMachine).start();

      service.stop();

      service.send({ type: 'TRIGGER' });

      setTimeout(() => {
        expect(called).toBeFalsy();
        expect(warnSpy.mock.calls).toMatchInlineSnapshot(`
          [
            [
              "Event "TRIGGER" was sent to stopped actor "x:0 (x:0)". This actor has already reached its final state, and will not transition.
          Event: {"type":"TRIGGER"}",
            ],
          ]
        `);
        resolve();
      }, 10);
      return promise;
    });

    it('stopping a not-started interpreter should not crash', () => {
      const service = createActor(
        next_createMachine({
          initial: 'a',
          states: { a: {} }
        })
      );

      expect(() => {
        service.stop();
      }).not.toThrow();
    });
  });

  describe('.unsubscribe()', () => {
    it('should remove transition listeners', () => {
      const toggleMachine = next_createMachine({
        id: 'toggle',
        initial: 'inactive',
        states: {
          inactive: {
            on: { TOGGLE: 'active' }
          },
          active: {
            on: { TOGGLE: 'inactive' }
          }
        }
      });

      const toggleService = createActor(toggleMachine).start();

      let stateCount = 0;

      const listener = () => stateCount++;

      const sub = toggleService.subscribe(listener);

      expect(stateCount).toEqual(0);

      toggleService.send({ type: 'TOGGLE' });

      expect(stateCount).toEqual(1);

      toggleService.send({ type: 'TOGGLE' });

      expect(stateCount).toEqual(2);

      sub.unsubscribe();
      toggleService.send({ type: 'TOGGLE' });

      expect(stateCount).toEqual(2);
    });
  });

  describe('transient states', () => {
    it('should transition in correct order', () => {
      const stateMachine = next_createMachine({
        id: 'transient',
        initial: 'idle',
        states: {
          idle: { on: { START: 'transient' } },
          transient: { always: 'next' },
          next: { on: { FINISH: 'end' } },
          end: { type: 'final' }
        }
      });

      const stateValues: StateValue[] = [];
      const service = createActor(stateMachine);
      service.subscribe((current) => stateValues.push(current.value));
      service.start();
      service.send({ type: 'START' });

      const expectedStateValues = ['idle', 'next'];
      expect(stateValues.length).toEqual(expectedStateValues.length);
      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });

    it('should transition in correct order when there is a condition', () => {
      const alwaysFalse = () => false;
      const stateMachine = next_createMachine(
        {
          id: 'transient',
          initial: 'idle',
          states: {
            idle: { on: { START: 'transient' } },
            transient: {
              // always: [
              //   { target: 'end', guard: 'alwaysFalse' },
              //   { target: 'next' }
              // ]
              always: () => {
                if (alwaysFalse()) {
                  return { target: 'end' };
                }
                return { target: 'next' };
              }
            },
            next: { on: { FINISH: 'end' } },
            end: { type: 'final' }
          }
        }
        // {
        //   guards: {
        //     alwaysFalse: () => false
        //   }
        // }
      );

      const stateValues: StateValue[] = [];
      const service = createActor(stateMachine);
      service.subscribe((current) => stateValues.push(current.value));
      service.start();
      service.send({ type: 'START' });

      const expectedStateValues = ['idle', 'next'];
      expect(stateValues.length).toEqual(expectedStateValues.length);
      for (let i = 0; i < expectedStateValues.length; i++) {
        expect(stateValues[i]).toEqual(expectedStateValues[i]);
      }
    });
  });

  describe('observable', () => {
    const context = { count: 0 };
    const intervalMachine = next_createMachine({
      id: 'interval',
      // types: {} as { context: typeof context },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context,
      initial: 'active',
      states: {
        active: {
          after: {
            // 10: {
            //   target: 'active',
            //   reenter: true,
            //   actions: assign({
            //     count: ({ context }) => context.count + 1
            //   })
            // }
            10: ({ context }) => {
              return {
                target: 'active',
                context: {
                  count: context.count + 1
                },
                reenter: true
              };
            }
          },
          // always: {
          //   target: 'finished',
          //   guard: ({ context }) => context.count >= 5
          // }
          always: ({ context }) => {
            if (context.count >= 5) {
              return { target: 'finished' };
            }
          }
        },
        finished: {
          type: 'final'
        }
      }
    });

    it('should be subscribable', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      let count: number;
      const intervalService = createActor(intervalMachine).start();

      expect(typeof intervalService.subscribe === 'function').toBeTruthy();

      intervalService.subscribe(
        (state) => {
          count = state.context.count;
        },
        undefined,
        () => {
          expect(count).toEqual(5);
          resolve();
        }
      );
      return promise;
    });

    it('should be interoperable with RxJS, etc. via Symbol.observable', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      let count = 0;
      const intervalService = createActor(intervalMachine).start();

      const state$ = from(intervalService);

      state$.subscribe({
        next: () => {
          count += 1;
        },
        error: undefined,
        complete: () => {
          expect(count).toEqual(5);
          resolve();
        }
      });
      return promise;
    });

    it('should be unsubscribable', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const countContext = { count: 0 };
      const machine = next_createMachine({
        // types: {} as { context: typeof countContext },
        schemas: {
          context: z.object({
            count: z.number()
          })
        },
        context: countContext,
        initial: 'active',
        states: {
          active: {
            // always: {
            //   target: 'finished',
            //   guard: ({ context }) => context.count >= 5
            // },
            always: ({ context }) => {
              if (context.count >= 5) {
                return { target: 'finished' };
              }
            },
            on: {
              // INC: {
              //   actions: assign({ count: ({ context }) => context.count + 1 })
              // }
              INC: ({ context }) => ({
                context: {
                  count: context.count + 1
                }
              })
            }
          },
          finished: {
            type: 'final'
          }
        }
      });

      let count: number;
      const service = createActor(machine);
      service.subscribe({
        complete: () => {
          expect(count).toEqual(2);
          resolve();
        }
      });
      service.start();

      const subscription = service.subscribe(
        (state) => (count = state.context.count)
      );

      service.send({ type: 'INC' });
      service.send({ type: 'INC' });
      subscription.unsubscribe();
      service.send({ type: 'INC' });
      service.send({ type: 'INC' });
      service.send({ type: 'INC' });
      return promise;
    });

    it('should call complete() once a final state is reached', () => {
      const completeCb = vi.fn();

      const service = createActor(
        next_createMachine({
          initial: 'idle',
          states: {
            idle: {
              on: {
                NEXT: 'done'
              }
            },
            done: { type: 'final' }
          }
        })
      ).start();

      service.subscribe({
        complete: completeCb
      });

      service.send({ type: 'NEXT' });

      expect(completeCb).toHaveBeenCalledTimes(1);
    });

    it('should call complete() once the interpreter is stopped', () => {
      const completeCb = vi.fn();

      const service = createActor(next_createMachine({})).start();

      service.subscribe({
        complete: () => {
          completeCb();
        }
      });

      service.stop();

      expect(completeCb).toHaveBeenCalledTimes(1);
    });
  });

  describe('actors', () => {
    it("doesn't crash cryptically on undefined return from the actor creator", () => {
      const child = fromCallback(() => {
        // nothing
      });
      const machine = next_createMachine(
        {
          initial: 'initial',
          states: {
            initial: {
              invoke: {
                src: child
              }
            }
          }
        }
        // {
        //   actors: {
        //     testService: child
        //   }
        // }
      );

      const service = createActor(machine);
      expect(() => service.start()).not.toThrow();
    });
  });

  describe('children', () => {
    it('state.children should reference invoked child actors (machine)', () => {
      const childMachine = next_createMachine({
        initial: 'active',
        states: {
          active: {
            on: {
              // FIRE: {
              //   actions: sendParent({ type: 'FIRED' })
              // }
              FIRE: ({ parent }, enq) => {
                enq.sendTo(parent, { type: 'FIRED' });
              }
            }
          }
        }
      });
      const parentMachine = next_createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'childActor',
              src: childMachine
            },
            on: {
              FIRED: 'success'
            }
          },
          success: {
            type: 'final'
          }
        }
      });

      const actor = createActor(parentMachine);
      actor.start();
      actor.getSnapshot().children.childActor.send({ type: 'FIRE' });

      // the actor should be done by now
      expect(actor.getSnapshot().children).not.toHaveProperty('childActor');
    });

    it('state.children should reference invoked child actors (promise)', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const num = fromPromise(
        () =>
          new Promise<number>((res) => {
            setTimeout(() => {
              res(42);
            }, 100);
          })
      );
      const parentMachine = next_createMachine(
        {
          initial: 'active',

          states: {
            active: {
              invoke: {
                id: 'childActor',
                src: num,
                // onDone: [
                //   {
                //     target: 'success',
                //     guard: ({ event }) => {
                //       return event.output === 42;
                //     }
                //   },
                //   { target: 'failure' }
                // ]
                onDone: ({ event }) => {
                  if (event.output === 42) {
                    return { target: 'success' };
                  }
                  return { target: 'failure' };
                }
              }
            },
            success: {
              type: 'final'
            },
            failure: {
              type: 'final'
            }
          }
        }
        // {
        //   actors: {
        //     num: fromPromise(
        //       () =>
        //         new Promise<number>((res) => {
        //           setTimeout(() => {
        //             res(42);
        //           }, 100);
        //         })
        //     )
        //   }
        // }
      );

      const service = createActor(parentMachine);

      service.subscribe({
        next: (state) => {
          if (state.matches('active')) {
            const childActor = state.children.childActor;

            expect(childActor).toHaveProperty('send');
          }
        },
        complete: () => {
          expect(service.getSnapshot().matches('success')).toBeTruthy();
          expect(service.getSnapshot().children).not.toHaveProperty(
            'childActor'
          );
          resolve();
        }
      });

      service.start();
      return promise;
    });

    it('state.children should reference invoked child actors (observable)', () => {
      const { resolve, promise } = Promise.withResolvers<void>();
      const interval$ = interval(10);
      const intervalLogic = fromObservable(() => interval$);

      const parentMachine = next_createMachine(
        {
          // types: {} as {
          //   actors: {
          //     src: 'intervalLogic';
          //     logic: typeof intervalLogic;
          //   };
          // },
          initial: 'active',
          states: {
            active: {
              invoke: {
                id: 'childActor',
                src: intervalLogic,
                // onSnapshot: {
                //   target: 'success',
                //   guard: ({ event }) => {
                //     return event.snapshot.context === 3;
                //   }
                // }
                onSnapshot: ({ event }) => {
                  if (event.snapshot.context === 3) {
                    return { target: 'success' };
                  }
                }
              }
            },
            success: {
              type: 'final'
            }
          }
        }
        // {
        //   actors: {
        //     intervalLogic
        //   }
        // }
      );

      const service = createActor(parentMachine);
      service.subscribe({
        complete: () => {
          expect(service.getSnapshot().children).not.toHaveProperty(
            'childActor'
          );
          resolve();
        }
      });

      service.subscribe((state) => {
        if (state.matches('active')) {
          expect(state.children['childActor']).not.toBeUndefined();
        }
      });

      service.start();
      return promise;
    });

    it.skip('state.children should reference spawned actors', () => {
      const childMachine = next_createMachine({
        initial: 'idle',
        states: {
          idle: {}
        }
      });
      const formMachine = next_createMachine({
        id: 'form',
        initial: 'idle',
        schemas: {
          // context: z.object({
          //   firstNameRef: z.any()
          // })
        },
        context: {},
        // entry: assign({
        //   firstNameRef: ({ spawn }) => spawn(childMachine, { id: 'child' })
        // }),
        entry: (_, enq) => ({
          children: {
            child: enq.spawn(childMachine)
          }
        }),
        states: {
          idle: {}
        }
      });

      const actor = createActor(formMachine);
      actor.start();
      expect(actor.getSnapshot().children).toHaveProperty('child');
    });

    // TODO: need to detect children returned from transition functions
    it.skip('stopped spawned actors should be cleaned up in parent', () => {
      const childMachine = next_createMachine({
        initial: 'idle',
        states: {
          idle: {}
        }
      });

      const parentMachine = next_createMachine({
        id: 'form',
        initial: 'present',
        // context: {} as {
        //   machineRef: ActorRefFrom<typeof childMachine>;
        //   promiseRef: ActorRefFrom<typeof fromPromise>;
        //   observableRef: AnyActorRef;
        // },
        schemas: {
          // context: z.object({
          //   machineRef: z.any(),
          //   promiseRef: z.any(),
          //   observableRef: z.any()
          // })
        },
        // context: {},
        entry: (_, enq) => ({
          children: {
            machineChild: enq.spawn(childMachine),
            promiseChild: enq.spawn(
              fromPromise(
                () =>
                  new Promise(() => {
                    // ...
                  })
              )
            ),
            observableChild: enq.spawn(fromObservable(() => interval(1000)))
          }
        }),
        states: {
          present: {
            on: {
              // NEXT: {
              //   target: 'gone',
              //   actions: [
              //     stopChild(({ context }) => context.machineRef),
              //     stopChild(({ context }) => context.promiseRef),
              //     stopChild(({ context }) => context.observableRef)
              //   ]
              // }
              NEXT: ({ children }, enq) => {
                enq.stop(children.machineChild);
                enq.stop(children.promiseChild);
                enq.stop(children.observableChild);
                return { target: 'gone' };
              }
            }
          },
          gone: {
            type: 'final'
          }
        }
      });

      const service = createActor(parentMachine).start();

      expect(service.getSnapshot().children).toHaveProperty('machineChild');
      expect(service.getSnapshot().children).toHaveProperty('promiseChild');
      expect(service.getSnapshot().children).toHaveProperty('observableChild');

      service.send({ type: 'NEXT' });

      expect(service.getSnapshot().children.machineChild).toBeUndefined();
      expect(service.getSnapshot().children.promiseChild).toBeUndefined();
      expect(service.getSnapshot().children.observableChild).toBeUndefined();
    });
  });

  it("shouldn't execute actions when reading a snapshot of not started actor", () => {
    const spy = vi.fn();
    const actorRef = createActor(
      next_createMachine({
        entry: (_, enq) => enq.action(spy)
      })
    );

    actorRef.getSnapshot();

    expect(spy).not.toHaveBeenCalled();
  });

  it(`should execute entry actions when starting the actor after reading its snapshot first`, () => {
    const spy = vi.fn();

    const actorRef = createActor(
      next_createMachine({
        entry: (_, enq) => enq.action(spy)
      })
    );

    actorRef.getSnapshot();
    expect(spy).not.toHaveBeenCalled();

    actorRef.start();

    expect(spy).toHaveBeenCalled();
  });

  it('the first state of an actor should be its initial state', () => {
    const machine = next_createMachine({});
    const actor = createActor(machine);
    const initialState = actor.getSnapshot();

    actor.start();

    expect(actor.getSnapshot()).toBe(initialState);
  });

  it('should call an onDone callback immediately if the service is already done', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          type: 'final'
        }
      }
    });

    const service = createActor(machine).start();

    expect(service.getSnapshot().status).toBe('done');

    service.subscribe({
      complete: () => {
        resolve();
      }
    });
    return promise;
  });
});

it('should throw if an event is received', () => {
  const machine = next_createMachine({});

  const actor = createActor(machine).start();

  expect(() =>
    actor.send(
      // @ts-ignore
      'EVENT'
    )
  ).toThrow();
});

it('should not process events sent directly to own actor ref before initial entry actions are processed', () => {
  const actual: string[] = [];
  const machine = next_createMachine({
    entry: (_, enq) => {
      enq.action(() => actual.push('initial root entry start'));
      // enq.action(() =>
      //   actorRef.send({
      //     type: 'EV'
      //   })
      // );
      enq.raise({ type: 'EV' });

      enq.action(() => actual.push('initial root entry end'));
    },
    on: {
      // EV: {
      //   actions: () => {
      //     actual.push('EV transition');
      //   }
      // }
      EV: (_, enq) => {
        enq.action(() => actual.push('EV transition'));
      }
    },
    initial: 'a',
    states: {
      a: {
        entry: (_, enq) => {
          enq.action(() => actual.push('initial nested entry'));
        }
      }
    }
  });

  const actorRef = createActor(machine);
  actorRef.start();

  expect(actual).toEqual([
    'initial root entry start',
    'initial root entry end',
    'initial nested entry',
    'EV transition'
  ]);
});

it('should not notify the completion observer for an active logic when it gets subscribed before starting', () => {
  const spy = vi.fn();

  const machine = next_createMachine({});
  createActor(machine).subscribe({ complete: spy });

  expect(spy).not.toHaveBeenCalled();
});

it('should notify the error observer for an errored logic when it gets subscribed after it errors', () => {
  const spy = vi.fn();

  const machine = next_createMachine({
    entry: () => {
      throw new Error('error');
    }
  });
  const actorRef = createActor(machine);
  actorRef.subscribe({ error: () => {} });
  actorRef.start();

  actorRef.subscribe({
    error: spy
  });

  expect(spy.mock.calls).toMatchInlineSnapshot(`
    [
      [
        [Error: error],
      ],
    ]
  `);
});
