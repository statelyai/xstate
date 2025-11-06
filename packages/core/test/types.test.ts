import { from } from 'rxjs';
import { createEmptyActor, fromCallback, fromPromise } from '../src/actors';
import {
  ActorRefFrom,
  ActorRefFromLogic,
  AnyActorLogic,
  StateMachine,
  UnknownActorRef,
  createActor,
  createStateConfig,
  next_createMachine,
  toPromise
} from '../src/index';
import { createInertActorScope } from '../src/getNextSnapshot';
import z from 'zod';

function noop(_x: unknown) {
  return;
}

describe('Raise events', () => {
  it('should accept a valid event type', () => {
    next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      // entry: raise({
      //   type: 'FOO'
      // })
      entry: (_, enq) =>
        enq.raise({
          type: 'FOO'
        })
    });
  });

  it('should reject an invalid event type', () => {
    next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      entry: (_, enq) =>
        enq.raise({
          // @ts-expect-error
          type: 'UNKNOWN'
        })
    });
  });

  it('should reject a string event type', () => {
    const event: { type: string } = { type: 'something' };

    next_createMachine({
      // types: {
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      // @ts-expect-error
      entry: (_, enq) => enq.raise(event)
    });
  });

  it('should provide a narrowed down expression event type when used as a transition action', () => {
    next_createMachine({
      // types: {
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      on: {
        // FOO: {
        //   actions: raise(({ event }) => {
        //     ((_arg: 'FOO') => {})(event.type);
        //     // @ts-expect-error
        //     ((_arg: 'BAR') => {})(event.type);

        //     return {
        //       type: 'BAR' as const
        //     };
        //   })
        // }
        FOO: ({ event }, enq) => {
          ((_arg: 'FOO') => {})(event.type);

          // @ts-expect-error
          ((_arg: 'BAR') => {})(event.type);

          const ev = {
            type: 'BAR' as const
          };

          enq.raise(ev);
        }
      }
    });
  });

  it('should accept a valid event type returned from an expression', () => {
    next_createMachine({
      // types: {
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      entry: (_, enq) =>
        enq.raise({
          type: 'BAR' as const
        })
    });
  });

  it('should reject an invalid event type returned from an expression', () => {
    next_createMachine({
      // types: {
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      entry: (_, enq) =>
        enq.raise({
          // @ts-expect-error
          type: 'UNKNOWN'
        })
    });
  });

  it('should reject a string event type returned from an expression', () => {
    const event: { type: string } = { type: 'something' };

    next_createMachine({
      // types: {
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      // @ts-expect-error
      // entry: raise(() => event)
      entry: (_, enq) => enq.raise(event)
    });
  });
});

describe('context', () => {
  it('defined context in next_createMachine() should be an object', () => {
    next_createMachine({
      // @ts-expect-error
      context: 'string'
    });
  });

  it('context should be required if present in types', () => {
    next_createMachine(
      // @ts-expect-error
      {
        // types: {} as {
        //   context: { count: number };
        // }
        schemas: {
          context: z.object({
            count: z.number()
          })
        }
      }
    );

    next_createMachine({
      // types: {} as {
      //   context: { count: number };
      // },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: {
        count: 0
      }
    });

    next_createMachine({
      // types: {} as {
      //   context: { count: number };
      // },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: () => ({
        count: 0
      })
    });
  });
});

describe('output', () => {
  it('output type should be represented in state', () => {
    const machine = next_createMachine({
      // types: {} as {
      //   output: number;
      // },
      schemas: {
        output: z.number()
      },
      output: 42
    });

    const state = machine.getInitialSnapshot(createInertActorScope(machine));

    ((_accept: number | undefined) => {})(state.output);
    // @ts-expect-error
    ((_accept: number) => {})(state.output);
    // @ts-expect-error
    ((_accept: string) => {})(state.output);
  });

  it('should accept valid static output', () => {
    next_createMachine({
      // types: {} as {
      //   output: number;
      // },
      schemas: {
        output: z.number()
      },
      output: 42
    });
  });

  it('should reject invalid static output', () => {
    next_createMachine({
      // types: {} as {
      //   output: number;
      // },
      schemas: {
        output: z.number()
      },
      // @ts-expect-error
      output: 'a string'
    });
  });

  it('should accept valid dynamic output', () => {
    next_createMachine({
      // types: {} as {
      //   output: number;
      // },
      schemas: {
        output: z.number()
      },
      output: () => 42
    });
  });

  it('should reject invalid dynamic output', () => {
    next_createMachine({
      // types: {} as {
      //   output: number;
      // },
      schemas: {
        output: z.number()
      },
      // @ts-expect-error
      output: () => 'a string'
    });
  });

  it('should provide the context type to the dynamic top-level output', () => {
    next_createMachine({
      // types: {} as {
      //   context: { password: string };
      //   output: {
      //     secret: string;
      //   };
      // },
      schemas: {
        context: z.object({
          password: z.string()
        }),
        output: z.object({
          secret: z.string()
        })
      },
      context: { password: 'okoń' },
      output: ({ context }) => {
        ((_accept: string) => {})(context.password);
        // @ts-expect-error
        ((_accept: number) => {})(context.password);
        return {
          secret: 'the secret'
        };
      }
    });
  });

  it('should provide the context type to the dynamic nested output', () => {
    next_createMachine({
      // types: {} as {
      //   context: { password: string };
      //   output: {
      //     secret: string;
      //   };
      // },
      schemas: {
        context: z.object({
          password: z.string()
        }),
        output: z.object({
          secret: z.string()
        })
      },
      context: { password: 'okoń' },
      initial: 'secret',
      states: {
        secret: {
          initial: 'reveal',
          states: {
            reveal: {
              type: 'final',
              output: ({ context }) => {
                ((_accept: string) => {})(context.password);
                // @ts-expect-error
                ((_accept: number) => {})(context.password);
                return {
                  secret: 'the secret'
                };
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });
  });
});

describe('emitted', () => {
  it('emitted type should be represented in actor.on(…)', () => {
    // const m = setup({
    //   types: {
    //     emitted: {} as
    //       | { type: 'onClick'; x: number; y: number }
    //       | { type: 'onChange' }
    //   }
    // }).createMachine({});

    const m = next_createMachine({
      schemas: {
        emitted: z.union([
          z.object({
            type: z.literal('onClick'),
            x: z.number(),
            y: z.number()
          }),
          z.object({ type: z.literal('onChange') })
        ])
      }
    });

    const actor = createActor(m);

    actor.on('onClick', (ev) => {
      ev.x satisfies number;

      // @ts-expect-error
      ev.x satisfies string;
    });

    actor.on('onChange', () => {});

    // @ts-expect-error
    actor.on('unknown', () => {});
  });
});

it('should not use actions as possible inference sites', () => {
  next_createMachine({
    // types: {
    //   context: {} as {
    //     count: number;
    //   }
    // },
    schemas: {
      context: z.object({
        count: z.number()
      })
    },
    context: {
      count: 0
    },
    entry: ({ context }) => {
      ((_accept: number) => {})(context.count);
      // @ts-expect-error
      ((_accept: string) => {})(context.count);
    }
  });
});

it('should not widen literal types defined in `schema.context` based on `config.context`', () => {
  next_createMachine({
    // types: {
    //   context: {} as {
    //     literalTest: 'foo' | 'bar';
    //   }
    // },
    schemas: {
      context: z.object({
        literalTest: z.union([z.literal('foo'), z.literal('bar')])
      })
    },
    context: {
      // @ts-expect-error
      literalTest: 'anything'
    }
  });
});

describe('states', () => {
  it('should accept a state handling subset of events as part of the whole config handling superset of those events', () => {
    const italicState = {
      on: {
        TOGGLE_BOLD: () => {}
      }
    };

    const boldState = {
      on: {
        TOGGLE_BOLD: () => {}
      }
    };

    next_createMachine({
      // types: {} as {
      //   events: { type: 'TOGGLE_ITALIC' } | { type: 'TOGGLE_BOLD' };
      // },
      schemas: {
        events: z.union([
          z.object({ type: z.literal('TOGGLE_ITALIC') }),
          z.object({ type: z.literal('TOGGLE_BOLD') })
        ])
      },
      type: 'parallel',
      states: {
        italic: italicState,
        bold: boldState
      }
    });
  });

  // technically it wouldn't be a big problem accepting this, such transitions would just never be selected
  // it's not worth complicating our types to support this though unless a strong argument is made in favor for this
  it('should not accept a state handling an event type outside of the events accepted by the machine', () => {
    const underlineState = {
      on: {
        TOGGLE_UNDERLINE: () => {}
      }
    } as const;

    next_createMachine({
      // types: {} as {
      //   events: { type: 'TOGGLE_ITALIC' } | { type: 'TOGGLE_BOLD' };
      // },
      schemas: {
        events: z.union([
          z.object({ type: z.literal('TOGGLE_ITALIC') }),
          z.object({ type: z.literal('TOGGLE_BOLD') })
        ])
      },
      type: 'parallel',
      states: {
        // @ts-expect-error
        underline: underlineState
      }
    });
  });
});

describe('events', () => {
  it('should not use actions as possible inference sites 1', () => {
    const machine = next_createMachine({
      // types: {
      //   events: {} as {
      //     type: 'FOO';
      //   }
      // },
      schemas: {
        events: z.object({
          type: z.literal('FOO')
        })
      },
      entry: (_, enq) => enq.raise({ type: 'FOO' })
    });

    const service = createActor(machine).start();

    service.send({ type: 'FOO' });
    // @ts-expect-error
    service.send({ type: 'UNKNOWN' });
  });

  it('should not use actions as possible inference sites 2', () => {
    const machine = next_createMachine({
      // types: {
      //   events: {} as {
      //     type: 'FOO';
      //   }
      // },
      schemas: {
        events: z.object({
          type: z.literal('FOO')
        })
      },
      entry: (_, enq) => enq.raise({ type: 'FOO' })
    });

    const service = createActor(machine).start();

    service.send({ type: 'FOO' });
    // @ts-expect-error
    service.send({ type: 'UNKNOWN' });
  });

  it('event type should be inferable from a simple state machine type', () => {
    const toggleMachine = next_createMachine({
      // types: {} as {
      //   context: {
      //     count: number;
      //   };
      //   events: {
      //     type: 'TOGGLE';
      //   };
      // },
      schemas: {
        context: z.object({
          count: z.number()
        }),
        events: z.object({
          type: z.literal('TOGGLE')
        })
      },
      context: {
        count: 0
      }
    });

    function acceptMachine<
      TContext extends {},
      TEvent extends { type: string }
    >(
      _machine: StateMachine<
        TContext,
        TEvent,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any, // TMeta
        any
      >
    ) {}

    acceptMachine(toggleMachine);
  });

  it('should infer inline function parameters when narrowing transition actions based on the event type', () => {
    next_createMachine({
      // types: {
      //   context: {} as {
      //     count: number;
      //   },
      //   events: {} as
      //     | { type: 'EVENT_WITH_FLAG'; flag: boolean }
      //     | {
      //         type: 'EVENT_WITHOUT_FLAG';
      //       }
      // },
      schemas: {
        context: z.object({
          count: z.number()
        }),
        events: z.union([
          z.object({ type: z.literal('EVENT_WITH_FLAG'), flag: z.boolean() }),
          z.object({ type: z.literal('EVENT_WITHOUT_FLAG') })
        ])
      },
      context: {
        count: 0
      },
      on: {
        // EVENT_WITH_FLAG: {
        //   actions: ({ event }) => {
        //     ((_accept: 'EVENT_WITH_FLAG') => {})(event.type);
        //     ((_accept: boolean) => {})(event.flag);
        //     // @ts-expect-error
        //     ((_accept: 'is not any') => {})(event);
        //   }
        // }
        EVENT_WITH_FLAG: ({ event }) => {
          ((_accept: 'EVENT_WITH_FLAG') => {})(event.type);
          ((_accept: boolean) => {})(event.flag);
          // @ts-expect-error
          ((_accept: 'is not any') => {})(event);
        }
      }
    });
  });

  it('should infer inline function parameters when for a wildcard transition', () => {
    next_createMachine({
      // types: {
      //   context: {} as {
      //     count: number;
      //   },
      //   events: {} as
      //     | { type: 'EVENT_WITH_FLAG'; flag: boolean }
      //     | {
      //         type: 'EVENT_WITHOUT_FLAG';
      //       }
      // },
      schemas: {
        context: z.object({
          count: z.number()
        }),
        events: z.union([
          z.object({ type: z.literal('EVENT_WITH_FLAG'), flag: z.boolean() }),
          z.object({ type: z.literal('EVENT_WITHOUT_FLAG') })
        ])
      },
      context: {
        count: 0
      },
      on: {
        // '*': {
        //   actions: ({ event }) => {
        //     ((_accept: 'EVENT_WITH_FLAG' | 'EVENT_WITHOUT_FLAG') => {})(
        //       event.type
        //     );
        //     // @ts-expect-error
        //     ((_accept: 'is not any') => {})(event);
        //   }
        // }
        '*': ({ event }) => {
          ((_accept: 'EVENT_WITH_FLAG' | 'EVENT_WITHOUT_FLAG') => {})(
            event.type
          );
          // @ts-expect-error
          ((_accept: 'is not any') => {})(event);
        }
      }
    });
  });

  it('should infer inline function parameter with a partial transition descriptor matching multiple events with the matching count of segments', () => {
    next_createMachine({
      // types: {} as {
      //   events:
      //     | { type: 'mouse.click.up'; direction: 'up' }
      //     | { type: 'mouse.click.down'; direction: 'down' }
      //     | { type: 'mouse.move' }
      //     | { type: 'mouse' }
      //     | { type: 'keypress' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('mouse.click.up'),
            direction: z.literal('up')
          }),
          z.object({
            type: z.literal('mouse.click.down'),
            direction: z.literal('down')
          }),
          z.object({ type: z.literal('mouse.move') }),
          z.object({ type: z.literal('mouse') }),
          z.object({ type: z.literal('keypress') })
        ])
      },
      on: {
        // 'mouse.click.*': {
        //   actions: ({ event }) => {
        //     ((_accept: 'mouse.click.up' | 'mouse.click.down') => {})(
        //       event.type
        //     );
        //     ((_accept: 'up' | 'down') => {})(event.direction);
        //     // @ts-expect-error
        //     ((_accept: 'not any') => {})(event.type);
        //   }
        // }
        'mouse.click.*': ({ event }) => {
          ((_accept: 'mouse.click.up' | 'mouse.click.down') => {})(event.type);
          ((_accept: 'up' | 'down') => {})(event.direction);
          // @ts-expect-error
          ((_accept: 'not any') => {})(event.type);
        }
      }
    });
  });

  it('should infer inline function parameter with a partial transition descriptor matching multiple events with the same count of segments or more', () => {
    next_createMachine({
      // types: {} as {
      //   events:
      //     | { type: 'mouse.click.up'; direction: 'up' }
      //     | { type: 'mouse.click.down'; direction: 'down' }
      //     | { type: 'mouse.move' }
      //     | { type: 'mouse' }
      //     | { type: 'keypress' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('mouse.click.up'),
            direction: z.literal('up')
          }),
          z.object({
            type: z.literal('mouse.click.down'),
            direction: z.literal('down')
          }),
          z.object({ type: z.literal('mouse.move') }),
          z.object({ type: z.literal('mouse') }),
          z.object({ type: z.literal('keypress') })
        ])
      },
      on: {
        // 'mouse.*': {
        //   actions: ({ event }) => {
        //     ((
        //       _accept: 'mouse.click.up' | 'mouse.click.down' | 'mouse.move'
        //     ) => {})(event.type);
        //     // @ts-expect-error
        //     ((_accept: 'not any') => {})(event.type);
        //   }
        // }
        'mouse.*': ({ event }) => {
          ((
            _accept: 'mouse.click.up' | 'mouse.click.down' | 'mouse.move'
          ) => {})(event.type);
          // @ts-expect-error
          ((_accept: 'not any') => {})(event.type);
        }
      }
    });
  });

  it('should not allow a transition using an event type matching the possible prefix but one that is outside of the defines ones', () => {
    next_createMachine({
      // types: {} as {
      //   events:
      //     | { type: 'mouse.click.up'; direction: 'up' }
      //     | { type: 'mouse.click.down'; direction: 'down' }
      //     | { type: 'mouse.move' }
      //     | { type: 'mouse' }
      //     | { type: 'keypress' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('mouse.click.up'),
            direction: z.literal('up')
          }),
          z.object({
            type: z.literal('mouse.click.down'),
            direction: z.literal('down')
          }),
          z.object({ type: z.literal('mouse.move') }),
          z.object({ type: z.literal('mouse') }),
          z.object({ type: z.literal('keypress') })
        ])
      },
      on: {
        // @ts-expect-error
        'mouse.doubleClick': {}
      }
    });
  });

  it('should not allow a transition using an event type matching the possible prefix but one that is outside of the defines ones', () => {
    next_createMachine({
      // types: {} as {
      //   events:
      //     | { type: 'mouse.click.up'; direction: 'up' }
      //     | { type: 'mouse.click.down'; direction: 'down' }
      //     | { type: 'mouse.move' }
      //     | { type: 'mouse' }
      //     | { type: 'keypress' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('mouse.click.up'),
            direction: z.literal('up')
          }),
          z.object({
            type: z.literal('mouse.click.down'),
            direction: z.literal('down')
          }),
          z.object({ type: z.literal('mouse.move') }),
          z.object({ type: z.literal('mouse') }),
          z.object({ type: z.literal('keypress') })
        ])
      },
      on: {
        // @ts-expect-error
        'mouse.doubleClick': {}
      }
    });
  });

  it(`should infer inline function parameter only using a direct match when the transition descriptor doesn't has a trailing wildcard`, () => {
    next_createMachine({
      // types: {} as {
      //   events:
      //     | { type: 'mouse.click.up'; direction: 'up' }
      //     | { type: 'mouse.click.down'; direction: 'down' }
      //     | { type: 'mouse.move' }
      //     | { type: 'mouse' }
      //     | { type: 'keypress' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('mouse.click.up'),
            direction: z.literal('up')
          }),
          z.object({
            type: z.literal('mouse.click.down'),
            direction: z.literal('down')
          }),
          z.object({ type: z.literal('mouse.move') }),
          z.object({ type: z.literal('mouse') }),
          z.object({ type: z.literal('keypress') })
        ])
      },
      on: {
        // mouse: {
        //   actions: ({ event }) => {
        //     ((_accept: 'mouse') => {})(event.type);
        //     // @ts-expect-error
        //     ((_accept: 'not any') => {})(event.type);
        //   }
        // }
        mouse: ({ event }) => {
          ((_accept: 'mouse') => {})(event.type);
          // @ts-expect-error
          ((_accept: 'not any') => {})(event.type);
        }
      }
    });
  });

  it('should not allow a transition using a partial descriptor related to an event type that is only defined exxactly', () => {
    next_createMachine({
      // types: {} as {
      //   events:
      //     | { type: 'mouse.click.up'; direction: 'up' }
      //     | { type: 'mouse.click.down'; direction: 'down' }
      //     | { type: 'mouse.move' }
      //     | { type: 'mouse' }
      //     | { type: 'keypress' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('mouse.click.up'),
            direction: z.literal('up')
          }),
          z.object({
            type: z.literal('mouse.click.down'),
            direction: z.literal('down')
          }),
          z.object({ type: z.literal('mouse.move') }),
          z.object({ type: z.literal('mouse') }),
          z.object({ type: z.literal('keypress') })
        ])
      },
      on: {
        // @ts-expect-error
        'keypress.*': {}
      }
    });
  });

  it('should provide the default TEvent to transition actions when there is no specific TEvent configured', () => {
    next_createMachine({
      // types: {
      //   context: {} as {
      //     count: number;
      //   }
      // },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: {
        count: 0
      },
      on: {
        // FOO: {
        //   actions: ({ event }) => {
        //     ((_accept: string) => {})(event.type);
        //   }
        // }
        FOO: ({ event }) => {
          ((_accept: string) => {})(event.type);
        }
      }
    });
  });

  it('should provide contextual `event` type in transition actions when the matching event has a union `.type`', () => {
    next_createMachine({
      // types: {} as {
      //   events:
      //     | {
      //         type: 'FOO' | 'BAR';
      //         value: string;
      //       }
      //     | {
      //         type: 'OTHER';
      //       };
      // },
      schemas: {
        events: z.union([
          z.object({ type: z.literal('FOO'), value: z.string() }),
          z.object({ type: z.literal('OTHER') })
        ])
      },
      on: {
        // FOO: {
        //   actions: ({ event }) => {
        //     event.type satisfies 'FOO' | 'BAR'; // it could be narrowed down to `FOO` but it's not worth the effort/complexity
        //     event.value satisfies string;
        //     // @ts-expect-error
        //     event.value satisfies number;
        //   }
        // }
        FOO: ({ event }) => {
          event.type satisfies 'FOO' | 'BAR'; // it could be narrowed down to `FOO` but it's not worth the effort/complexity
          event.value satisfies string;
          // @ts-expect-error
          event.value satisfies number;
        }
      }
    });
  });
});

describe('interpreter', () => {
  it('should be convertible to Rx observable', () => {
    const s = createActor(
      next_createMachine({
        // types: {
        //   context: {} as { count: number }
        // },
        schemas: {
          context: z.object({
            count: z.number()
          })
        },
        context: {
          count: 0
        }
      })
    );
    const state$ = from(s);

    state$.subscribe((state) => {
      ((_val: number) => {})(state.context.count);
      // @ts-expect-error
      ((_val: string) => {})(state.context.count);
    });
  });
});

describe('spawnChild action', () => {
  it('should reject actor outside of the defined ones at usage site', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: {
        child
      },
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child);
        enq.spawn(
          // @ts-expect-error
          actors.other
        );
      }
    });
  });

  it('should accept a defined actor at usage site', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: {
        child
      },
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child);
      }
    });
  });

  it('should allow valid configured actor id', () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actors: {
        child
      },
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, { id: 'ok1' });
      }
    });
  });

  it('should disallow invalid actor id', () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   'child',
      //   {
      //     id: 'child'
      //   }
      // )
      entry: ({ actors }, enq) => {
        // @ts-expect-error
        enq.spawn(actors.child, { id: 'child' });
      }
    });
  });

  it('should require id to be specified when it was configured', () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry:
      //   // @ts-expect-error
      //   spawnChild('child')
      entry: ({ actors }, enq) => {
        // @ts-expect-error
        enq.spawn(actors.child);
      }
    });
  });

  it(`shouldn't require id to be specified when it was not configured`, () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild('child')
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child);
      }
    });
  });

  it(`should allow id to be specified when it was not configured`, () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild('child', { id: 'someId' })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, { id: 'someId' });
      }
    });
  });

  it(`should allow anonymous inline actor outside of the configured actors`, () => {
    const child1 = next_createMachine({
      context: {
        counter: 0
      }
    });

    const child2 = next_createMachine({
      context: {
        answer: ''
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child1;
      //   };
      // },
      actors: { child1 },
      // entry: spawnChild(child2)
      entry: ({ actors }, enq) => {
        enq.spawn(child2);
      }
    });
  });

  it(`should disallow anonymous inline actor with an id outside of the configured actors`, () => {
    const child1 = next_createMachine({
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      }
    });

    const child2 = next_createMachine({
      schemas: {
        context: z.object({
          answer: z.string()
        })
      },
      context: {
        answer: ''
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child1;
      //     id: 'myChild';
      //   };
      // },
      actors: { child1 },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   child2,
      //   { id: 'myChild' }
      // )
      entry: ({ actors }, enq) => {
        // @ts-expect-error
        enq.spawn(child2, { id: 'myChild' });
      }
    });
  });

  it(`should reject static wrong input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   'child',
      //   {
      //     input: 'hello'
      //   }
      // )
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          // @ts-expect-error
          input: 'hello'
        });
      }
    });
  });

  it(`should allow static correct input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild('child', {
      //   input: 42
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          input: 42
        });
      }
    });
  });

  it(`should allow static input that is a subtype of the expected one`, () => {
    const child = fromPromise(({}: { input: number | string }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild('child', {
      //   input: 42
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          input: 42
        });
      }
    });
  });

  it(`should reject static input that is a supertype of the expected one`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   'child',
      //   {
      //     input: Math.random() > 0.5 ? 'string' : 42
      //   }
      // )
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          // @ts-expect-error
          input: Math.random() > 0.5 ? 'string' : 42
        });
      }
    });
  });

  it(`should reject dynamic wrong input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   'child',
      //   {
      //     input: () => 'hello'
      //   }
      // )
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          // @ts-expect-error
          input: 'hello'
        });
      }
    });
  });

  it(`should allow dynamic correct input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild('child', {
      //   input: () => 42
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          input: 42
        });
      }
    });
  });

  it(`should reject dynamic input that is a supertype of the expected one`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   'child',
      //   {
      //     input: () => (Math.random() > 0.5 ? 42 : 'hello')
      //   }
      // )
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          // @ts-expect-error
          input: Math.random() > 0.5 ? 42 : 'hello'
        });
      }
    });
  });

  it(`should allow dynamic input that is a subtype of the expected one`, () => {
    const child = fromPromise(({}: { input: number | string }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: spawnChild('child', {
      //   input: () => 'hello'
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          input: 'hello'
        });
      }
    });
  });

  it(`should reject a valid input of a different provided actor`, () => {
    const child1 = fromPromise(({}: { input: number }) => Promise.resolve(100));

    const child2 = fromPromise(({}: { input: string }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors:
      //     | {
      //         src: 'child1';
      //         logic: typeof child1;
      //       }
      //     | {
      //         src: 'child2';
      //         logic: typeof child2;
      //       };
      // },
      actors: { child1, child2 },
      // entry:
      //   // @ts-expect-error
      //   spawnChild('child1', {
      //     input: 'hello'
      //   })
      entry: ({ actors }, enq) => {
        // @ts-expect-error
        enq.spawn(actors.child1, {
          input: 'hello'
        });
      }
    });
  });

  it(`should require input to be specified when it is required`, () => {
    const child = fromPromise(({}: { input: number }) => Promise.resolve(100));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child');
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        // @ts-expect-error
        enq.spawn(actors.child);
      }
    });
  });

  it(`should not require input when it's optional`, () => {
    const child = fromPromise(({}: { input: number | undefined }) =>
      Promise.resolve(100)
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child');
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child);
      }
    });
  });
});

describe('spawner in assign', () => {
  it('should reject actor outside of the defined ones at usage site', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('other');
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(
          // @ts-expect-error
          actors.other
        );
        return {};
      }
    });
  });

  it('should accept a defined actor at usage site', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child');
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child);
        return {};
      }
    });
  });

  it('should allow valid configured actor id', () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child', { id: 'ok1' });
      //   return {};
      // })
      entry: (_, enq) => {
        enq.spawn(child, { id: 'ok1' });
        return {};
      }
    });
  });

  it('should disallow invalid actor id', () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child', {
      //     id: 'child'
      //   });
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        // @ts-expect-error
        enq.spawn(actors.child, { id: 'child' });
        return {};
      }
    });
  });

  it('should require id to be specified when it was configured', () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child');
      //   return {};
      // })
      entry: (_, enq) => {
        // @ts-expect-error
        enq.spawn(child);
        return {};
      }
    });
  });

  it(`shouldn't require id to be specified when it was not configured`, () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child');
      //   return {};
      // })
      entry: (_, enq) => {
        enq.spawn(child);
        return {};
      }
    });
  });

  it(`should allow id to be specified when it was not configured`, () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child', { id: 'someId' });
      //   return {};
      // })
      entry: (_, enq) => {
        enq.spawn(child, { id: 'someId' });
        return {};
      }
    });
  });

  it(`should allow anonymous inline actor outside of the configured actors`, () => {
    const child1 = next_createMachine({
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      }
    });

    const child2 = next_createMachine({
      schemas: {
        context: z.object({
          answer: z.string()
        })
      },
      context: {
        answer: ''
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child1;
      //   };
      // },
      actors: { child1 },
      // entry: assign(({ spawn }) => {
      //   spawn(child2);
      //   return {};
      // })
      entry: (_, enq) => {
        enq.spawn(child2);
        return {};
      }
    });
  });

  it(`should no allow anonymous inline actor with an id outside of the configured ones`, () => {
    const child1 = next_createMachine({
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      }
    });

    const child2 = next_createMachine({
      schemas: {
        context: z.object({
          answer: z.string()
        })
      },
      context: {
        answer: ''
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child1;
      //     id: 'myChild';
      //   };
      // },
      actors: { child1 },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn(child2, { id: 'myChild' });
      //   return {};
      // })
      entry: (_, enq) => {
        // @ts-expect-error
        enq.spawn(child2, { id: 'myChild' });
        return {};
      }
    });
  });

  it(`should reject static wrong input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child', {
      //     input: 'hello'
      //   });
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          // @ts-expect-error
          input: 'hello'
        });
        return {};
      }
    });
  });

  it(`should allow static correct input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child', {
      //     input: 42
      //   });
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          input: 42
        });
        return {};
      }
    });
  });

  it(`should allow static input that is a subtype of the expected one`, () => {
    const child = fromPromise(({}: { input: number | string }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child', {
      //     input: 42
      //   });
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          input: 42
        });
        return {};
      }
    });
  });

  it(`should reject static input that is a supertype of the expected one`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child', {
      //     input: Math.random() > 0.5 ? 'string' : 42
      //   });
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          // @ts-expect-error
          input: Math.random() > 0.5 ? 'string' : 42
        });
        return {};
      }
    });
  });

  it(`should reject an attempt to provide dynamic input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child, {
          // @ts-expect-error
          input: () => 42
        });
        return {};
      }
    });
  });

  it(`should return a concrete actor ref type based on actor logic argument, one that is assignable to a location expecting that concrete actor ref type`, () => {
    const child = next_createMachine({
      // types: {} as {
      //   context: {
      //     counter: number;
      //   };
      // },
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 100
      }
    });

    next_createMachine({
      // types: {} as {
      //   context: {
      //     myChild?: ActorRefFrom<typeof child>;
      //   };
      // },
      schemas: {
        context: z.object({
          myChild: z.custom<ActorRefFrom<typeof child>>().optional()
        })
      },
      context: {},
      // entry: assign({
      //   myChild: ({ spawn }) => {
      //     return spawn(child);
      //   }
      // })
      entry: (_, enq) => {
        return {
          context: {
            myChild: enq.spawn(child)
          }
        };
      }
    });
  });

  it(`should return a concrete actor ref type based on actor logic argument, one that isn't assignable to a location expecting a different concrete actor ref type`, () => {
    const child = next_createMachine({
      // types: {} as {
      //   context: {
      //     counter: number;
      //   };
      // },
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 100
      }
    });

    const otherChild = next_createMachine({
      // types: {} as {
      //   context: {
      //     title: string;
      //   };
      // },
      schemas: {
        context: z.object({
          title: z.string()
        })
      },
      context: {
        title: 'The Answer'
      }
    });

    next_createMachine({
      // types: {} as {
      //   context: {
      //     myChild?: ActorRefFrom<typeof child>;
      //   };
      // },
      schemas: {
        context: z.object({
          myChild: z.custom<ActorRefFrom<typeof child>>().optional()
        })
      },
      context: {},
      // entry: assign({
      //   // @ts-expect-error
      //   myChild: ({ spawn }) => {
      //     return spawn(otherChild);
      //   }
      // })
      entry: (_, enq) => {
        return {
          context: {
            myChild:
              // @ts-expect-error
              enq.spawn(otherChild)
          }
        };
      }
    });
  });

  it(`should require input to be specified when it is required`, () => {
    const child = fromPromise(({}: { input: number }) => Promise.resolve(100));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child');
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        // @ts-expect-error
        enq.spawn(actors.child);
      }
    });
  });

  it(`should not require input when it's optional`, () => {
    const child = fromPromise(({}: { input: number | undefined }) =>
      Promise.resolve(100)
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child');
      //   return {};
      // })
      entry: ({ actors }, enq) => {
        enq.spawn(actors.child);
      }
    });
  });
});

describe('invoke', () => {
  it('should reject actor outside of the defined ones at usage site', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) =>
          // @ts-expect-error
          actors.other
      }
    });
  });

  it('should accept a defined actor at usage site', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child
      }
    });
  });

  it('should allow valid configured actor id', () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        id: 'ok1',
        src: ({ actors }) => actors.child
      }
    });
  });

  it('should disallow invalid actor id', () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        // @ts-expect-error
        id: 'child',
        src: ({ actors }) => actors.child
      }
    });
  });

  it('should require id to be specified when it was configured', () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // @ts-expect-error
      invoke: {
        src: ({ actors }) => actors.child
      }
    });
  });

  it(`shouldn't require id to be specified when it was not configured`, () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child
      }
    });
  });

  it(`should allow id to be specified when it was not configured`, () => {
    const child = next_createMachine({});

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        id: 'someId',
        src: ({ actors }) => actors.child
      }
    });
  });

  it(`should allow anonymous inline actor outside of the configured actors`, () => {
    const child1 = next_createMachine({
      context: {
        counter: 0
      }
    });

    const child2 = next_createMachine({
      context: {
        answer: ''
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child1;
      //   };
      // },
      actors: { child1 },
      invoke: {
        src: child2
      }
    });
  });

  it(`should diallow anonymous inline actor with an id outside of the configured actors`, () => {
    const child1 = next_createMachine({
      context: {
        counter: 0
      }
    });

    const child2 = next_createMachine({
      context: {
        answer: ''
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child1;
      //     id: 'myChild';
      //   };
      // },
      actors: { child1 },
      invoke: {
        src: child2,
        // @ts-expect-error
        id: 'myChild'
      }
    });
  });

  it(`should reject static wrong input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child,
        // @ts-expect-error
        input: 'hello'
      }
    });
  });

  it(`should allow static correct input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child,
        input: 42
      }
    });
  });

  it(`should allow static input that is a subtype of the expected one`, () => {
    const child = fromPromise(({}: { input: number | string }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child,
        input: 42
      }
    });
  });

  it(`should reject static input that is a supertype of the expected one`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child,
        // @ts-expect-error
        input: Math.random() > 0.5 ? 'string' : 42
      }
    });
  });

  it(`should reject dynamic wrong input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child,
        // @ts-expect-error
        input: () => 'hello'
      }
    });
  });

  it(`should allow dynamic correct input`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child,
        input: () => 42
      }
    });
  });

  it(`should reject dynamic input that is a supertype of the expected one`, () => {
    const child = fromPromise(({}: { input: number }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child,
        // @ts-expect-error
        input: () => (Math.random() > 0.5 ? 42 : 'hello')
      }
    });
  });

  it(`should allow dynamic input that is a subtype of the expected one`, () => {
    const child = fromPromise(({}: { input: number | string }) =>
      Promise.resolve('foo')
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child,
        input: () => 'hello'
      }
    });
  });

  it(`should require input to be specified when it is required`, () => {
    const child = fromPromise(({}: { input: number }) => Promise.resolve(100));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      // @ts-expect-error
      invoke: {
        src: ({ actors }) => actors.child
      }
    });
  });

  it(`should not require input when it's optional`, () => {
    const child = fromPromise(({}: { input: number | undefined }) =>
      Promise.resolve(100)
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        src: ({ actors }) => actors.child
      }
    });
  });
});

describe('actor implementations', () => {
  it('should reject actor outside of the defined ones in provided implementations', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: { child }
    }).provide({
      actors: {
        // @ts-expect-error
        other: child
      }
    });
  });

  it('should accept a defined actor in provided implementations', () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: { child }
    }).provide({
      actors: {
        child
      }
    });
  });

  it(`should reject the provided actor when the output doesn't match`, () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: { child }
    }).provide({
      actors: {
        // @ts-expect-error
        child: fromPromise(() => Promise.resolve(42))
      }
    });
  });

  it(`should reject the provided actor when its output is a super type of the expected one`, () => {
    const child = fromPromise(() => Promise.resolve('foo'));

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: { child }
    }).provide({
      actors: {
        // @ts-expect-error
        child: fromPromise(() =>
          Promise.resolve(Math.random() > 0.5 ? 'foo' : 42)
        )
      }
    });
  });

  it(`should accept the provided actor when its output is a sub type of the expected one`, () => {
    const child = fromPromise(() =>
      Promise.resolve(Math.random() > 0.5 ? 'foo' : 42)
    );

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    }).provide({
      actors: {
        // TODO: ideally this shouldn't error
        // @ts-expect-error
        child: fromPromise(() => Promise.resolve('foo'))
      }
    });
  });

  it('should allow an actor with the expected snapshot type', () => {
    const child = next_createMachine({
      // types: {} as {
      //   context: {
      //     foo: string;
      //   };
      // },
      schemas: {
        context: z.object({
          foo: z.string()
        })
      },
      context: {
        foo: 'bar'
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    }).provide({
      actors: {
        child
      }
    });
  });

  it('should reject an actor with an incorrect snapshot type', () => {
    const child = next_createMachine({
      // types: {} as {
      //   context: {
      //     foo: string;
      //   };
      // },
      schemas: {
        context: z.object({
          foo: z.string()
        })
      },
      context: {
        foo: 'bar'
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    }).provide({
      actors: {
        // @ts-expect-error
        child: next_createMachine({
          // types: {} as {
          //   context: {
          //     foo: number;
          //   };
          // },
          schemas: {
            context: z.object({
              foo: z.number()
            })
          },
          context: {
            foo: 100
          }
        })
      }
    });
  });

  it('should allow an actor with a snapshot type that is a subtype of the expected one', () => {
    const child = next_createMachine({
      // types: {} as {
      //   context: {
      //     foo: string | number;
      //   };
      // },
      schemas: {
        context: z.object({
          foo: z.union([z.string(), z.number()])
        })
      },
      context: {
        foo: 'bar'
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    }).provide({
      actors: {
        // TODO: ideally this should be allowed
        // @ts-expect-error
        child: next_createMachine({
          // types: {} as {
          //   context: {
          //     foo: string;
          //   };
          // },
          schemas: {
            context: z.object({
              foo: z.string()
            })
          },
          context: {
            foo: 'bar'
          }
        })
      }
    });
  });

  it('should reject an actor with a snapshot type that is a supertype of the expected one', () => {
    const child = next_createMachine({
      // types: {} as {
      //   context: {
      //     foo: string;
      //   };
      // },
      schemas: {
        context: z.object({
          foo: z.string()
        })
      },
      context: {
        foo: 'bar'
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    }).provide({
      actors: {
        // @ts-expect-error
        child: next_createMachine({
          // types: {} as {
          //   context: {
          //     foo: string | number;
          //   };
          // },
          schemas: {
            context: z.object({
              foo: z.union([z.string(), z.number()])
            })
          },
          context: {
            foo: 'bar'
          }
        })
      }
    });
  });

  it('should allow an actor with the expected event types', () => {
    const child = next_createMachine({
      // types: {} as {
      //   events: {
      //     type: 'EV_1';
      //   };
      // }
      schemas: {
        events: z.object({
          type: z.literal('EV_1')
        })
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    }).provide({
      actors: {
        child
      }
    });
  });

  it('should reject an actor with wrong event types', () => {
    const child = next_createMachine({
      // types: {} as {
      //   events: {
      //     type: 'EV_1';
      //   };
      // }
      schemas: {
        events: z.object({
          type: z.literal('EV_1')
        })
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    }).provide({
      actors: {
        // @ts-expect-error
        child: next_createMachine({
          // types: {} as {
          //   events: {
          //     type: 'OTHER';
          //   };
          // }
          schemas: {
            events: z.object({
              type: z.literal('OTHER')
            })
          }
        })
      }
    });
  });

  it('should reject an actor with an event type that is a subtype of the expected one', () => {
    const child = next_createMachine({
      // types: {} as {
      //   events:
      //     | {
      //         type: 'EV_1';
      //       }
      //     | {
      //         type: 'EV_2';
      //       };
      // }
      schemas: {
        events: z.union([
          z.object({ type: z.literal('EV_1') }),
          z.object({ type: z.literal('EV_2') })
        ])
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    }).provide({
      actors: {
        // the provided actor has to be able to handle all the event types that it might receive from the parent here
        // @ts-expect-error
        child: next_createMachine({
          // types: {} as {
          //   events: {
          //     type: 'EV_1';
          //   };
          // }
          schemas: {
            events: z.object({
              type: z.literal('EV_1')
            })
          }
        })
      }
    });
  });

  it('should allow an actor with a snapshot type that is a supertype of the expected one', () => {
    const child = next_createMachine({
      // types: {} as {
      //   events: {
      //     type: 'EV_1';
      //   };
      // }
      schemas: {
        events: z.object({
          type: z.literal('EV_1')
        })
      }
    });

    next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    }).provide({
      actors: {
        // TODO: ideally this should be allowed since the provided actor is capable of handling all the event types that it might receive from the parent here
        // @ts-expect-error
        child: next_createMachine({
          // types: {} as {
          //   events:
          //     | {
          //         type: 'EV_1';
          //       }
          //     | {
          //         type: 'EV_2';
          //       };
          // }
          schemas: {
            events: z.union([
              z.object({ type: z.literal('EV_1') }),
              z.object({ type: z.literal('EV_2') })
            ])
          }
        })
      }
    });
  });
});

describe('state.children without setup', () => {
  it('should return the correct child type on the available snapshot when the child ID for the actor was configured', () => {
    const child = next_createMachine({
      // types: {} as {
      //   context: {
      //     foo: string;
      //   };
      // },
      schemas: {
        context: z.object({
          foo: z.string()
        })
      },
      context: {
        foo: ''
      }
    });

    const machine = next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'someChild';
      //     logic: typeof child;
      //   };
      // },
      actors: { child },
      invoke: {
        id: 'someChild',
        src: ({ actors }) => actors.child
      }
    });

    const snapshot = createActor(machine).getSnapshot();
    const childSnapshot = snapshot.children.someChild!.getSnapshot();

    childSnapshot.context.foo satisfies string | undefined;
    childSnapshot.context.foo satisfies string;
    // @ts-expect-error
    childSnapshot.context.foo satisfies '';
    // @ts-expect-error
    childSnapshot.context.foo satisfies number | undefined;
  });

  it('should have an optional child on the available snapshot when the child ID for the actor was configured', () => {
    const child = next_createMachine({
      context: {
        counter: 0
      }
    });

    const machine = next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     id: 'myChild';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    });

    const childActor = createActor(machine).getSnapshot().children.myChild;

    childActor satisfies ActorRefFrom<typeof child> | undefined;
    // @ts-expect-error
    childActor satisfies ActorRefFrom<typeof child>;
  });

  it('should have an optional child on the available snapshot when the child ID for the actor was not configured', () => {
    const child = next_createMachine({
      context: {
        counter: 0
      }
    });

    const machine = next_createMachine({
      // types: {} as {
      //   actors: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actors: {
        child
      }
    });

    const childActor = createActor(machine).getSnapshot().children.someChild;

    childActor satisfies ActorRefFrom<typeof child> | undefined;
    // @ts-expect-error
    childActor satisfies ActorRefFrom<typeof child>;
  });

  it('should not have an index signature on the available snapshot when child IDs were configured for all actors', () => {
    const child1 = next_createMachine({
      context: {
        counter: 0
      }
    });

    const child2 = next_createMachine({
      context: {
        answer: ''
      }
    });

    const machine = next_createMachine({
      // types: {} as {
      //   actors:
      //     | {
      //         src: 'child1';
      //         id: 'counter';
      //         logic: typeof child1;
      //       }
      //     | {
      //         src: 'child2';
      //         id: 'quiz';
      //         logic: typeof child2;
      //       };
      // }
      actors: {
        child1,
        child2
      }
    });

    createActor(machine).getSnapshot().children.counter;
    createActor(machine).getSnapshot().children.quiz;
    // @ts-expect-error
    createActor(machine).getSnapshot().children.someChild;
  });

  it('should have an index signature on the available snapshot when child IDs were configured only for some actors', () => {
    const child1 = next_createMachine({
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      }
    });

    const child2 = next_createMachine({
      schemas: {
        context: z.object({
          answer: z.string()
        })
      },
      context: {
        answer: ''
      }
    });

    const machine = next_createMachine({
      // types: {} as {
      //   actors:
      //     | {
      //         src: 'child1';
      //         id: 'counter';
      //         logic: typeof child1;
      //       }
      //     | {
      //         src: 'child2';
      //         logic: typeof child2;
      //       };
      // }
      actors: {
        child1,
        child2
      }
      // TODO: children schema
    });

    const counterActor = createActor(machine).getSnapshot().children.counter;
    counterActor satisfies ActorRefFrom<typeof child1> | undefined;

    const someActor = createActor(machine).getSnapshot().children.someChild;
    // @ts-expect-error
    someActor satisfies ActorRefFrom<typeof child2> | undefined;
    someActor satisfies
      | ActorRefFrom<typeof child1>
      | ActorRefFrom<typeof child2>
      | undefined;
  });
});

describe('actions', () => {
  it('context should get inferred for builtin actions used as an entry action', () => {
    next_createMachine({
      // types: {
      //   context: {} as { count: number }
      // },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: {
        count: 0
      },
      entry: ({ context }) => {
        ((_accept: number) => {})(context.count);
        // @ts-expect-error
        ((_accept: "ain't any") => {})(context.count);
        return {};
      }
    });
  });

  it('context should get inferred for builtin actions used as a transition action', () => {
    next_createMachine({
      // types: {
      //   context: {} as { count: number },
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        context: z.object({
          count: z.number()
        }),
        events: z.union([
          z.object({ type: z.literal('FOO') }),
          z.object({ type: z.literal('BAR') })
        ])
      },
      context: {
        count: 0
      },
      on: {
        FOO: ({ context }) => {
          ((_accept: number) => {})(context.count);
          // @ts-expect-error
          ((_accept: "ain't any") => {})(context.count);
          return {};
        }
      }
    });
  });

  it('should report an error when the stop action returns an invalid actor ref', () => {
    next_createMachine({
      // types: {
      //   context: {} as {
      //     count: number;
      //   }
      // },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: {
        count: 0
      },
      // entry: stopChild(
      //   // @ts-expect-error
      //   ({ context }) => {
      //     return context.count;
      //   }
      // )
      entry: ({ context }, enq) => {
        enq.stop(
          // @ts-expect-error
          context.count
        );
      }
    });
  });

  it('should NOT accept assign with partial static object', () => {
    next_createMachine({
      // types: {
      //   events: {} as {
      //     type: 'TOGGLE';
      //   },
      //   context: {} as {
      //     count: number;
      //     mode: 'foo' | 'bar' | null;
      //   }
      // },
      schemas: {
        events: z.object({
          type: z.literal('TOGGLE')
        }),
        context: z.object({
          count: z.number(),
          mode: z.union([z.literal('foo'), z.literal('bar'), z.literal(null)])
        })
      },
      context: {
        count: 0,
        mode: null
      },
      // @ts-expect-error
      entry: () => ({
        context: {
          mode: 'foo'
        }
      })
    });
  });

  it('should allow a defined parameterized action with params', () => {
    next_createMachine({
      // types: {} as {
      //   actions: { type: 'greet'; params: { name: string } } | { type: 'poke' };
      // },
      actions: {
        greet: (params: { name: string }) => {},
        poke: () => {}
      },
      entry: ({ actions }, enq) => {
        enq(actions.greet, {
          name: 'David'
        });
      }
    });
  });

  it('should disallow a non-defined parameterized action', () => {
    next_createMachine({
      // types: {} as {
      //   actions: { type: 'greet'; params: { name: string } } | { type: 'poke' };
      // },
      actions: {
        greet: (params: { name: string }) => {},
        poke: () => {}
      },
      entry: ({ actions }, enq) => {
        enq(
          // @ts-expect-error
          actions.other,
          {
            params: {
              foo: 'bar'
            }
          }
        );
      }
    });
  });

  it('should disallow a defined parameterized action with invalid params', () => {
    next_createMachine({
      // types: {} as {
      //   actions: { type: 'greet'; params: { name: string } } | { type: 'poke' };
      // },
      actions: {
        greet: (params: { name: string }) => {},
        poke: () => {}
      },
      entry: ({ actions }, enq) => {
        enq(actions.greet, {
          // @ts-expect-error
          kick: 'start'
        });
      }
    });
  });

  it('should disallow a defined parameterized action when it lacks required params', () => {
    next_createMachine({
      // types: {} as {
      //   actions: { type: 'greet'; params: { name: string } } | { type: 'poke' };
      // },
      actions: {
        greet: (params: { name: string }) => {},
        poke: () => {}
      },
      // entry: {
      //   type: 'greet',
      //   // @ts-expect-error
      //   params: {}
      // }
      entry: ({ actions }, enq) => {
        enq(
          actions.greet,
          // @ts-expect-error
          {}
        );
      }
    });
  });

  it("should allow a defined action without params when it only has optional params when it's referenced using an object", () => {
    next_createMachine({
      // types: {} as {
      //   actions:
      //     | { type: 'greet'; params: { name: string } }
      //     | { type: 'poke'; params?: { target: string } };
      // },
      actions: {
        greet: (params: { name: string }) => {},
        poke: (params?: { target: string }) => {}
      },
      entry: ({ actions }, enq) => {
        enq(actions.poke);
        enq(() => actions.poke());
      }
    });
  });

  it('should type action params as the specific defined params in the provided custom action', () => {
    next_createMachine({
      // types: {} as {
      //   actions:
      //     | { type: 'greet'; params: { name: string } }
      //     | { type: 'poke' };
      // }
      actions: {
        greet: (params: { name: string }) => {},
        poke: () => {}
      }
    }).provide({
      actions: {
        greet: (params) => {
          ((_accept: string) => {})(params.name);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params.name);
        }
      }
    });
  });

  it('should not allow a provided action outside of the defined ones', () => {
    next_createMachine({
      // types: {} as {
      //   actions:
      //     | { type: 'greet'; params: { name: string } }
      //     | { type: 'poke' };
      // }
      actions: {
        greet: (params: { name: string }) => {},
        poke: () => {}
      }
    }).provide({
      actions: {
        // @ts-expect-error
        other: () => {}
      }
    });
  });

  it('should allow dynamic params that return correct params type', () => {
    next_createMachine({
      // types: {} as {
      //   actions: { type: 'greet'; params: { name: string } } | { type: 'poke' };
      // },
      actions: {
        greet: (params: { name: string }) => {},
        poke: () => {}
      },
      // entry: {
      //   type: 'greet',
      //   params: () => ({
      //     name: 'Anders'
      //   })
      // }
      entry: ({ actions }, enq) => {
        enq(actions.greet, { name: 'Anders' });
      }
    });
  });

  it('should disallow dynamic params that return invalid params type', () => {
    next_createMachine({
      // types: {} as {
      //   actions:
      //     | { type: 'greet'; params: { surname: string } }
      //     | { type: 'poke' };
      // },
      actions: {
        greet: (params: { surname: string }) => {},
        poke: () => {}
      },
      // entry: {
      //   type: 'greet',
      //   // @ts-expect-error
      //   params: () => ({
      //     surname: 100
      //   })
      // }
      entry: ({ actions }, enq) => {
        enq(actions.greet, {
          // @ts-expect-error
          surname: 100
        });
      }
    });
  });

  it('should provide context type to dynamic params', () => {
    next_createMachine({
      // types: {} as {
      //   context: {
      //     count: number;
      //   };
      //   actions: { type: 'greet'; params: { name: string } } | { type: 'poke' };
      // },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      actions: {
        greet: (params: { name: string }) => {
          ((_accept: string) => {})(params.name);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params.name);
        }
      },
      context: { count: 1 },
      // entry: {
      //   type: 'greet',
      //   params: ({ context }) => {
      //     ((_accept: number) => {})(context.count);
      //     // @ts-expect-error
      //     ((_accept: 'not any') => {})(context.count);
      //     return {
      //       name: 'Anders'
      //     };
      //   }
      // }
      entry: ({ context, actions }, enq) => {
        ((_accept: number) => {})(context.count);
        // @ts-expect-error
        ((_accept: 'not any') => {})(context.count);

        enq(actions.greet, { name: 'Anders' });
      }
    });
  });

  it('should provide narrowed down event type to dynamic params', () => {
    next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      //   actions: { type: 'greet'; params: { name: string } } | { type: 'poke' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      actions: {
        greet: (params: { name: string }) => {
          ((_accept: string) => {})(params.name);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params.name);
        }
      },
      on: {
        // FOO: {
        //   actions: {
        //     type: 'greet',
        //     params: ({ event }) => {
        //       ((_accept: 'FOO') => {})(event.type);
        //       // @ts-expect-error
        //       ((_accept: 'not any') => {})(event.type);
        //       return {
        //         name: 'Anders'
        //       };
        //     }
        //   }
        // }
        FOO: ({ actions, event }) => {
          ((_accept: 'FOO') => {})(event.type);
          // @ts-expect-error
          ((_accept: 'not any') => {})(event.type);
          actions.greet({ name: 'Anders' });
        }
      }
    });
  });
});

describe('input', () => {
  it('should provide the input type to the context factory', () => {
    next_createMachine({
      types: {
        input: {} as {
          count: number;
        }
      },
      context: ({ input }) => {
        ((_accept: number) => {})(input.count);
        // @ts-expect-error
        ((_accept: string) => {})(input.count);
        return {};
      }
    });
  });

  it('should accept valid input type when interpreting an actor', () => {
    const machine = next_createMachine({
      types: {
        input: {} as {
          count: number;
        }
      }
    });

    createActor(machine, { input: { count: 100 } });
  });

  it('should reject invalid input type when interpreting an actor', () => {
    const machine = next_createMachine({
      types: {
        input: {} as {
          count: number;
        }
      }
    });

    createActor(machine, {
      input: {
        // @ts-expect-error
        count: ''
      }
    });
  });

  it('should require input to be specified when defined', () => {
    const machine = next_createMachine({
      types: {
        input: {} as {
          count: number;
        }
      }
    });

    // @ts-expect-error
    createActor(machine);
  });

  it('should not require input when not defined', () => {
    const machine = next_createMachine({
      types: {}
    });

    createActor(machine);
  });
});

describe('guards', () => {
  it('should allow a defined parameterized guard with params', () => {
    next_createMachine({
      // types: {} as {
      //   guards:
      //     | {
      //         type: 'isGreaterThan';
      //         params: {
      //           count: number;
      //         };
      //       }
      //     | { type: 'plainGuard' };
      // },
      guards: {
        isGreaterThan: (params: { count: number }) => {
          ((_accept: number) => {})(params.count);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params);
          return true;
        },
        plainGuard: () => true
      },
      on: {
        // EV: {
        //   guard: {
        //     type: 'isGreaterThan',
        //     params: {
        //       count: 10
        //     }
        //   }
        // }
        EV: ({ guards }) => {
          if (guards.isGreaterThan({ count: 10 })) {
            return {};
          }
        }
      }
    });
  });

  it('should disallow a non-defined parameterized guard', () => {
    next_createMachine({
      // types: {} as {
      //   guards:
      //     | {
      //         type: 'isGreaterThan';
      //         params: {
      //           count: number;
      //         };
      //       }
      //     | { type: 'plainGuard' };
      // },
      guards: {
        isGreaterThan: (params: { count: number }) => {
          ((_accept: number) => {})(params.count);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params);
          return true;
        },
        plainGuard: () => true
      },
      on: {
        // EV: {
        //   guard: {
        //     type: 'other',
        //     params: {
        //       foo: 'bar'
        //     }
        //   }
        // }
        EV: ({ guards }) => {
          if (
            guards
              // @ts-expect-error
              .other({ foo: 'bar' })
          ) {
            return {};
          }
        }
      }
    });
  });

  it('should disallow a defined parameterized guard with invalid params', () => {
    next_createMachine({
      // types: {} as {
      //   guards:
      //     | {
      //         type: 'isGreaterThan';
      //         params: {
      //           count: number;
      //         };
      //       }
      //     | { type: 'plainGuard' };
      // },
      guards: {
        isGreaterThan: (params: { count: number }) => {
          ((_accept: number) => {})(params.count);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params);
          return true;
        }
      },
      on: {
        // EV: {
        //   guard: {
        //     type: 'isGreaterThan',
        //     params: {
        //       count: 'bar'
        //     }
        //   }
        // }
        EV: ({ guards }) => {
          if (
            guards.isGreaterThan({
              // @ts-expect-error
              count: 'bar'
            })
          ) {
            return {};
          }
        }
      }
    });
  });

  it('should disallow a defined parameterized guard when it lacks required params', () => {
    next_createMachine({
      // types: {} as {
      //   guards:
      //     | {
      //         type: 'isGreaterThan';
      //         params: {
      //           count: number;
      //         };
      //       }
      //     | { type: 'plainGuard' };
      // },
      guards: {
        isGreaterThan: (params: { count: number }) => {
          ((_accept: number) => {})(params.count);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params);
          return true;
        }
      },
      on: {
        // EV: {
        //   guard: {
        //     type: 'isGreaterThan',
        //     params: {}
        //   }
        // }
        EV: ({ guards }) => {
          if (
            guards
              // @ts-expect-error
              .isGreaterThan()
          ) {
            return {};
          }
        }
      }
    });
  });

  it("should allow a defined guard without params when it only has optional params when it's referenced using an object", () => {
    next_createMachine({
      // types: {} as {
      //   guards:
      //     | {
      //         type: 'isGreaterThan';
      //         params: {
      //           count: number;
      //         };
      //       }
      //     | { type: 'plainGuard'; params?: { foo: string } };
      // },
      guards: {
        plainGuard: (params?: { foo: string }) => true,
        isGreaterThan: (params: { count: number }) => {
          ((_accept: number) => {})(params.count);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params);
          return true;
        }
      },
      on: {
        // EV: {
        //   guard: {
        //     type: 'plainGuard'
        //   }
        // }
        EV: ({ guards }) => {
          if (guards.plainGuard()) {
            return {};
          }
        }
      }
    });
  });

  it('should type guard params as the specific params in the provided custom guard', () => {
    next_createMachine({
      // types: {} as {
      //   guards:
      //     | {
      //         type: 'isGreaterThan';
      //         params: {
      //           count: number;
      //         };
      //       }
      //     | { type: 'plainGuard' };
      // }
      guards: {
        isGreaterThan: (params: { count: number }) => {
          ((_accept: number) => {})(params.count);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params);
          return true;
        }
      }
    }).provide({
      guards: {
        isGreaterThan: (params: { count: number }) => {
          ((_accept: number) => {})(params.count);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params);
          return true;
        }
      }
    });
  });

  it('should not allow a provided guard outside of the defined ones', () => {
    const machine = next_createMachine({
      guards: {
        isGreaterThan: (_params: { count: number }) => {
          return true;
        },
        plainGuard: () => true
      }
    }).provide({
      guards: {
        // @ts-expect-error
        other: () => true
      }
    });
  });

  it('should allow dynamic params that return correct params type', () => {
    next_createMachine({
      // types: {} as {
      //   guards:
      //     | {
      //         type: 'isGreaterThan';
      //         params: {
      //           count: number;
      //         };
      //       }
      //     | { type: 'plainGuard' };
      // },
      guards: {
        isGreaterThan: (params: { count: number }) => {
          ((_accept: number) => {})(params.count);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params);
          return true;
        }
      },
      on: {
        // FOO: {
        //   guard: {
        //     type: 'isGreaterThan',
        //     params: () => ({ count: 100 })
        //   }
        // }
        FOO: ({ guards }) => {
          if (guards.isGreaterThan({ count: 100 })) {
            return {};
          }
        }
      }
    });
  });

  it.only('should disallow dynamic params that return invalid params type', () => {
    next_createMachine({
      // types: {} as {
      //   guards:
      //     | {
      //         type: 'isGreaterThan';
      //         params: {
      //           count: number;
      //         };
      //       }
      //     | { type: 'plainGuard' };
      // },
      guards: {
        isGreaterThan: (params: { count: number }) => {
          ((_accept: number) => {})(params.count);
          // @ts-expect-error
          ((_accept: 'not any') => {})(params);
          return true;
        },
        plainGuard: () => true
      },
      on: {
        // FOO: {
        //   guard: {
        //     type: 'isGreaterThan',
        //     params: () => ({ count: 'bazinga' })
        //   }
        // }
        FOO: ({ guards }) => {
          if (
            guards.isGreaterThan({
              // @ts-expect-error
              count: 'bazinga'
            })
          ) {
            return {};
          }
        }
      }
    });
  });

  it('should provide context type to dynamic params', () => {
    next_createMachine({
      // types: {} as {
      //   context: {
      //     count: number;
      //   };
      //   guards:
      //     | {
      //         type: 'isGreaterThan';
      //         params: {
      //           count: number;
      //         };
      //       }
      //     | { type: 'plainGuard' };
      // },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      guards: {
        isGreaterThan: ({ count }: { count: number }) => {
          return true;
        }
      },
      context: { count: 1 },
      on: {
        // FOO: {
        //   guard: {
        //     type: 'isGreaterThan',
        //     params: ({ context }) => {
        //       ((_accept: number) => {})(context.count);
        //       // @ts-expect-error
        //       ((_accept: 'not any') => {})(context.count);
        //       return {
        //         count: context.count
        //       };
        //     }
        //   }
        // }
        FOO: ({ guards }) => {
          if (guards.isGreaterThan({ count: 100 })) {
            return {};
          }
          return {};
        }
      }
    });
  });
});

describe('delays', () => {
  it('should accept a plain number as key of an after transitions object when delays are declared', () => {
    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      after: {
        100: () => {}
      }
    });
  });

  it('should accept a defined delay type as key of an after transitions object when delays are declared', () => {
    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      after: {
        'one second': () => {}
      }
    });
  });

  it(`should reject delay as key of an after transitions object if it's outside of the defined ones`, () => {
    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      after: {
        // @ts-expect-error
        'unknown delay': {} // TODO: should be rejected
      }
    });
  });

  it('should accept a plain number as delay in `raise` when delays are declared', () => {
    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      // entry: raise({ type: 'FOO' }, { delay: 100 })
      entry: (_, enq) => {
        enq.raise({ type: 'FOO' }, { delay: 100 });
      }
    });
  });

  it('should accept a defined delay in `raise`', () => {
    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      // entry: raise({ type: 'FOO' }, { delay: 'one minute' })
      entry: (_, enq) => {
        enq.raise({ type: 'FOO' }, { delay: 'one minute' });
      }
    });
  });

  it('should reject a delay outside of the defined ones in `raise`', () => {
    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },

      // entry: raise(
      //   { type: 'FOO' },
      //   {
      //     // @ts-expect-error
      //     delay: 'unknown delay'
      //   }
      // )
      entry: (_, enq) => {
        enq.raise(
          { type: 'FOO' },
          {
            // @ts-expect-error
            delay: 'unknown delay'
          }
        );
      }
    });
  });

  it('should accept a plain number as delay in `sendTo` when delays are declared', () => {
    const otherActor = createActor(next_createMachine({}));

    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      // entry: sendTo(otherActor, { type: 'FOO' }, { delay: 100 })
      entry: (_, enq) => {
        enq.sendTo(otherActor, { type: 'FOO' }, { delay: 100 });
      }
    });
  });

  it('should accept a defined delay in `sendTo`', () => {
    const otherActor = createActor(next_createMachine({}));

    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      // entry: sendTo(otherActor, { type: 'FOO' }, { delay: 'one minute' })
      entry: (_, enq) => {
        enq.sendTo(otherActor, { type: 'FOO' }, { delay: 'one minute' });
      }
    });
  });

  it('should reject a delay outside of the defined ones in `sendTo`', () => {
    const otherActor = createActor(next_createMachine({}));

    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },

      // entry: sendTo(
      //   otherActor,
      //   { type: 'FOO' },
      //   {
      //     // @ts-expect-error
      //     delay: 'unknown delay'
      //   }
      // )
      entry: (_, enq) => {
        enq.sendTo(
          otherActor,
          { type: 'FOO' },
          {
            // @ts-expect-error
            delay: 'unknown delay'
          }
        );
      }
    });
  });

  it('should accept a plain number as delay in `raise` in `enqueueActions` when delays are declared', () => {
    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      // entry: enqueueActions(({ enqueue }) => {
      //   enqueue.raise({ type: 'FOO' }, { delay: 100 });
      // })
      entry: (_, enq) => {
        enq.raise({ type: 'FOO' }, { delay: 100 });
      }
    });
  });

  it('should accept a defined delay in `raise` in `enqueueActions`', () => {
    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      // entry: enqueueActions(({ enqueue }) => {
      //   enqueue.raise({ type: 'FOO' }, { delay: 'one minute' });
      // })
      entry: (_, enq) => {
        enq.raise({ type: 'FOO' }, { delay: 'one minute' });
      }
    });
  });

  it('should reject a delay outside of the defined ones in `raise` in `enqueueActions`', () => {
    next_createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      entry: (_, enq) => {
        enq.raise(
          { type: 'FOO' },
          {
            // @ts-expect-error
            delay: 'unknown delay'
          }
        );
      }
    });
  });

  it('should NOT accept any delay string when no explicit delays are defined', () => {
    next_createMachine({
      after: {
        // @ts-expect-error
        just_any_delay: {}
      }
    });
  });
});

describe('tags', () => {
  it(`should NOT allow a defined tag when it's set using a string`, () => {
    next_createMachine({
      // types: {} as {
      //   tags: 'pending' | 'success' | 'error';
      // },
      schemas: {
        tags: z.union([
          z.literal('pending'),
          z.literal('success'),
          z.literal('error')
        ])
      },
      // @ts-expect-error
      tags: 'pending'
    });
  });

  it(`should allow a defined tag when it's set using an array`, () => {
    next_createMachine({
      // types: {} as {
      //   tags: 'pending' | 'success' | 'error';
      // },
      schemas: {
        tags: z.union([
          z.literal('pending'),
          z.literal('success'),
          z.literal('error')
        ])
      },
      tags: ['pending']
    });
  });

  it(`should not allow a tag outside of the defined ones when it's set using a string`, () => {
    next_createMachine({
      // types: {} as {
      //   tags: 'pending' | 'success' | 'error';
      // },
      schemas: {
        tags: z.union([
          z.literal('pending'),
          z.literal('success'),
          z.literal('error')
        ])
      },
      // @ts-expect-error
      tags: 'other'
    });
  });

  it(`should not allow a tag outside of the defined ones when it's set using an array`, () => {
    next_createMachine({
      // types: {} as {
      //   tags: 'pending' | 'success' | 'error';
      // },
      schemas: {
        tags: z.union([
          z.literal('pending'),
          z.literal('success'),
          z.literal('error')
        ])
      },
      tags: [
        // @ts-expect-error
        'other'
      ]
    });
  });

  it('`hasTag` should allow checking a defined tag', () => {
    const machine = next_createMachine({
      // types: {} as {
      //   tags: 'a' | 'b' | 'c';
      // }
      schemas: {
        tags: z.union([z.literal('a'), z.literal('b'), z.literal('c')])
      }
    });

    const actor = createActor(machine).start();

    actor.getSnapshot().hasTag('a');
  });

  it('`hasTag` should not allow checking a tag outside of the defined ones', () => {
    const machine = next_createMachine({
      // types: {} as {
      //   tags: 'a' | 'b' | 'c';
      // }
      schemas: {
        tags: z.union([z.literal('a'), z.literal('b'), z.literal('c')])
      }
    });

    const actor = createActor(machine).start();

    // @ts-expect-error
    actor.getSnapshot().hasTag('other');
  });
});

describe('fromCallback', () => {
  it('should reject a start callback that returns an explicit promise', () => {
    next_createMachine({
      invoke: {
        src: fromCallback(
          // @ts-ignore
          () => {
            return new Promise(() => {});
          }
        )
      }
    });
  });

  it('should reject a start callback that is an async function', () => {
    // it's important to not give a false impression that we support returning promises from this setup as we supported that in the past
    // the problem is that people could accidentally~ use an async function for convenience purposes
    // then we'd listen for the promise to resolve and cleanup that actor, closing the communication channel between parent and the child
    //
    // fromCallback(async ({ sendBack }) => {
    //   const api = await getSomeWebApi(); // async function was used to conveniently use `await` here
    //
    //   // this didn't work as expected because this promise was completing almost asap
    //   // so the parent was never able to receive those events sent to it
    //   api.addEventListener('some_event', () => sendBack({ type: 'EV' }))
    //
    //   // implicit completion
    // })
    next_createMachine({
      invoke: {
        src: fromCallback(
          // @ts-ignore
          async () => {}
        )
      }
    });
  });

  it('should reject a start callback that returns a non-function and non-undefined value', () => {
    next_createMachine({
      invoke: {
        src: fromCallback(
          // @ts-ignore
          () => {
            return 42;
          }
        )
      }
    });
  });

  it('should allow returning an implicit undefined from the start callback', () => {
    next_createMachine({
      invoke: {
        src: fromCallback(() => {})
      }
    });
  });

  it('should allow returning an explicit undefined from the start callback', () => {
    next_createMachine({
      invoke: {
        src: fromCallback(() => {
          return undefined;
        })
      }
    });
  });

  it('should allow returning a cleanup function the start callback', () => {
    next_createMachine({
      invoke: {
        src: fromCallback(() => {
          return undefined;
        })
      }
    });
  });
});

describe('self', () => {
  it('should accept correct event types in an inline entry custom action', () => {
    next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      entry: ({ self }) => {
        self.send({ type: 'FOO' });
        self.send({ type: 'BAR' });
        // @ts-expect-error
        self.send({ type: 'BAZ' });
      }
    });
  });

  it('should accept correct event types in an inline entry builtin action', () => {
    next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      entry: ({ self }) => {
        self.send({ type: 'FOO' });
        self.send({ type: 'BAR' });
        // @ts-expect-error
        self.send({ type: 'BAZ' });
      }
    });
  });

  it('should accept correct event types in an inline transition custom action', () => {
    next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      on: {
        FOO: ({ self }) => {
          self.send({ type: 'FOO' });
          self.send({ type: 'BAR' });
          // @ts-expect-error
          self.send({ type: 'BAZ' });
        }
      }
    });
  });

  it('should accept correct event types in an inline transition builtin action', () => {
    next_createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('FOO')
          }),
          z.object({
            type: z.literal('BAR')
          })
        ])
      },
      on: {
        FOO: ({ self }) => {
          self.send({ type: 'FOO' });
          self.send({ type: 'BAR' });
          // @ts-expect-error
          self.send({ type: 'BAZ' });
          return {};
        }
      }
    });
  });

  it('should return correct snapshot in an inline entry custom action', () => {
    next_createMachine({
      // types: {} as {
      //   context: { count: number };
      // },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: { count: 0 },
      entry: ({ self }) => {
        ((_accept: number) => {})(self.getSnapshot().context.count);
        // @ts-expect-error
        ((_accept: string) => {})(self.getSnapshot().context.count);
      }
    });
  });

  it('should return correct snapshot in an inline entry action', () => {
    next_createMachine({
      // types: {} as {
      //   context: { count: number };
      // },
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: { count: 0 },
      // entry: assign(({ self }) => {
      //   ((_accept: number) => {})(self.getSnapshot().context.count);
      //   // @ts-expect-error
      //   ((_accept: string) => {})(self.getSnapshot().context.count);
      //   return {};
      // })
      entry: ({ self }) => {
        ((_accept: number) => {})(self.getSnapshot().context.count);
        // @ts-expect-error
        ((_accept: string) => {})(self.getSnapshot().context.count);
      }
    });
  });
});

describe('createActor', () => {
  it(`should require input to be specified when it is required`, () => {
    const logic = fromPromise(({}: { input: number }) => Promise.resolve(100));

    // @ts-expect-error
    createActor(logic);
  });

  it(`should not require input when it's optional`, () => {
    const logic = fromPromise(({}: { input: number | undefined }) =>
      Promise.resolve(100)
    );

    createActor(logic);
  });
});

describe('snapshot methods', () => {
  it('should type infer actor union snapshot methods', () => {
    const typeOne = next_createMachine({
      schemas: {
        events: z.object({
          type: z.literal('one')
        }),
        tags: z.literal('one')
      },
      initial: 'one',
      states: {
        one: {}
      }
    });
    type TypeOneRef = ActorRefFrom<typeof typeOne>;

    const typeTwo = next_createMachine({
      schemas: {
        events: z.union([
          z.object({
            type: z.literal('one')
          }),
          z.object({
            type: z.literal('two')
          })
        ]),
        tags: z.union([z.literal('one'), z.literal('two')])
      },
      initial: 'one',
      states: {
        one: {},
        two: {}
      }
    });

    type TypeTwoRef = ActorRefFrom<typeof typeTwo>;

    const ref = createActor(typeTwo) as TypeOneRef | TypeTwoRef;
    const snapshot = ref.getSnapshot();

    snapshot.can({ type: 'one' });
    // @ts-expect-error
    snapshot.can({ type: 'two' });
    // @ts-expect-error
    snapshot.can({ type: 'three' });

    snapshot.hasTag('one');
    // @ts-expect-error
    snapshot.hasTag('two');
    // @ts-expect-error
    snapshot.hasTag('three');

    snapshot.matches('one');
    // @ts-expect-error
    snapshot.matches('two');
    // @ts-expect-error
    snapshot.matches('three');

    snapshot.getMeta();
    snapshot.toJSON();
  });
});

// https://github.com/statelyai/xstate/issues/4931
it('fromPromise should not have issues with actors with emitted types', () => {
  // const machine = setup({
  //   types: {
  //     emitted: {} as { type: 'FOO' }
  //   }
  // }).createMachine({});
  const machine = next_createMachine({
    schemas: {
      emitted: z.object({
        type: z.literal('FOO')
      })
    }
  });

  const actor = createActor(machine).start();

  toPromise(actor);
});

it('UnknownActorRef should return a Snapshot-typed value from getSnapshot()', () => {
  const actor: UnknownActorRef = createEmptyActor();

  // @ts-expect-error
  actor.getSnapshot().status === 'FOO';
});

it('Actor<T> should be assignable to ActorRefFromLogic<T>', () => {
  const logic = next_createMachine({});

  class ActorThing<T extends AnyActorLogic> {
    actorRef: ActorRefFromLogic<T>;
    constructor(actorLogic: T) {
      const actor = createActor(actorLogic);

      actor satisfies ActorRefFromLogic<typeof actorLogic>;
      this.actorRef = actor;
    }
  }

  new ActorThing(logic);
});
