import { from } from 'rxjs';
import {
  createEmptyActor,
  createCallbackLogic,
  createAsyncLogic,
  createEventObservableLogic,
  createObservableLogic
} from '../src/actors';
import {
  ActorRefFrom,
  ActorRefFromLogic,
  AnyActorLogic,
  AnyActorRef,
  AnyMachineSnapshot,
  AnyStateMachine,
  BuiltInExecutableActionObject,
  CustomExecutableActionObject,
  ExecutableActionObject,
  InputFrom,
  OutputFrom,
  type SnapshotFrom,
  StateMachine,
  type StateValue,
  SpecialExecutableAction,
  type AnySetupConfig,
  type SetupReturnFromConfig,
  type StandardSchemaV1,
  UnknownActorRef,
  createActor,
  createLogic,
  createMachine,
  createSystem,
  initialTransition,
  isBuiltInExecutableAction,
  setup,
  types,
  toPromise
} from '../src/index';
import { createInertActorScope } from '../src/getNextSnapshot';
import type {
  DoneActorEvent,
  EventObject,
  TransitionConfigFunction
} from '../src/types';
import type { Next_StateNodeConfig } from '../src/types.v6';
import z from 'zod';
import * as z4 from 'zod/v4';

function noop(_x: unknown) {
  return;
}

type AnyNextStateNodeConfig = Next_StateNodeConfig<
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
  any,
  any
>;

describe('SpecialExecutableAction', () => {
  it('narrows built-in executable action fields by type', () => {
    const consume = (action: SpecialExecutableAction) => {
      switch (action.type) {
        case '@xstate.spawn':
          noop(action.actor);
          noop(action.id);
          noop(action.logic);
          noop(action.src);
          noop(action.input);
          break;
        case '@xstate.start':
          noop(action.actor);
          noop(action.id);
          break;
        case '@xstate.raise':
          noop(action.event);
          noop(action.id);
          noop(action.delay);
          break;
        case '@xstate.sendTo':
          noop(action.target);
          noop(action.event);
          noop(action.id);
          noop(action.delay);
          break;
        case '@xstate.cancel':
          noop(action.id);
          break;
        case '@xstate.stop':
          noop(action.actor);
          noop(action.id);
          break;
        case '@xstate.terminate':
          noop(action.actor);
          noop(action.id);
          noop(action.status);
          noop(action.output);
          noop(action.error);
          break;
        default: {
          const _exhaustive: never = action;
          noop(_exhaustive);
        }
      }
    };

    noop(consume);

    const action = {} as ExecutableActionObject;

    if (isBuiltInExecutableAction(action)) {
      const builtInAction: BuiltInExecutableActionObject = action;
      consume(builtInAction);
    }
  });

  it('preserves built-in discriminants from transition results', () => {
    const childMachine = createMachine({});
    const machine = createMachine({
      invoke: {
        src: childMachine,
        id: 'child'
      }
    });

    const [, actions] = initialTransition(machine);
    const action = actions[0];

    if (isBuiltInExecutableAction(action) && action.type === '@xstate.spawn') {
      noop(action.actor);
      noop(action.id);
      noop(action.logic);
      noop(action.src);
      noop(action.input);
      // @ts-expect-error spawn actions do not expose raise/send event payloads
      noop(action.event);
    }

    if (isBuiltInExecutableAction(action) && action.type === '@xstate.start') {
      noop(action.actor);
      noop(action.id);
      // @ts-expect-error start actions no longer expose logic
      noop(action.logic);
      // @ts-expect-error start actions no longer expose src
      noop(action.src);
      // @ts-expect-error start actions no longer expose input
      noop(action.input);
      // @ts-expect-error start actions do not expose raise/send event payloads
      noop(action.event);
    }

    if (isBuiltInExecutableAction(action) && action.type === '@xstate.raise') {
      noop(action.event);
      noop(action.id);
      noop(action.delay);
      // @ts-expect-error raise actions do not expose started actor metadata
      noop(action.actor);
    }
  });

  it('preserves custom executable actions in transition results', () => {
    const machine = createMachine({
      entry: (_, enq) => enq(function customEffect() {})
    });

    const [, actions] = initialTransition(machine);
    const action = actions[0];

    if (action.kind === 'action') {
      const customAction: CustomExecutableActionObject = action;
      noop(customAction.type);
      noop(customAction.args);
      noop(customAction.action);
      noop(customAction.exec);
    }
  });
});

describe('Raise events', () => {
  it('should accept a valid event type', () => {
    createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
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
    createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
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

    createMachine({
      // types: {
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
      },
      // @ts-expect-error
      entry: (_, enq) => enq.raise(event)
    });
  });

  it('should provide a narrowed down expression event type when used as a transition action', () => {
    createMachine({
      // types: {
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
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
    createMachine({
      // types: {
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
      },
      entry: (_, enq) =>
        enq.raise({
          type: 'BAR' as const
        })
    });
  });

  it('should reject an invalid event type returned from an expression', () => {
    createMachine({
      // types: {
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
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

    createMachine({
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
      },
      // @ts-expect-error
      // entry: raise(() => event)
      entry: (_, enq) => enq.raise(event)
    });
  });
});

describe('internalEvents', () => {
  it('should allow raising internal and external events', () => {
    const machine = createMachine({
      schemas: {
        events: {
          foo: z.object({}),
          tick: z.object({}),
          'change.value': z.object({ value: z.string() })
        }
      },
      internalEvents: ['tick', 'change.*'],
      on: {
        foo: (_, enq) => {
          enq.raise({ type: 'foo' });
          enq.raise({ type: 'tick' });
          enq.raise({ type: 'change.value', value: 'ok' });
        }
      }
    });

    const actor = createActor(machine);
    actor.send({ type: 'foo' });
  });

  it('should reject sending internal events from outside', () => {
    const machine = createMachine({
      schemas: {
        events: {
          foo: z.object({}),
          tick: z.object({}),
          'change.value': z.object({ value: z.string() })
        }
      },
      internalEvents: ['tick', 'change.*'] as const,
      on: {
        foo: {}
      }
    });

    const actor = createActor(machine);

    actor.send({ type: 'foo' });

    expect(() => actor.send({ type: 'tick' } as any)).toThrow(
      'Internal event "tick" cannot be sent to actor'
    );
    expect(() =>
      actor.send({ type: 'change.value', value: 'blocked' } as any)
    ).toThrow('Internal event "change.value" cannot be sent to actor');

    actor.trigger.foo();
    expect(() => (actor.trigger as any).tick()).toThrow(
      'Internal event "tick" cannot be sent to actor'
    );
    expect(() =>
      (actor.trigger as any)['change.value']({ value: 'blocked' })
    ).toThrow('Internal event "change.value" cannot be sent to actor');

    function _expectSendRejected(a: typeof actor) {
      // @ts-expect-error internal events are not sendable from outside
      a.send({ type: 'tick' });
      // @ts-expect-error internal events are not sendable from outside
      a.send({ type: 'change.value', value: 'blocked' });
    }
    void _expectSendRejected;

    function _expectTriggerRejected(a: typeof actor) {
      // @ts-expect-error internal events are not sendable from outside
      a.trigger.tick();
      // @ts-expect-error internal events are not sendable from outside
      a.trigger['change.value']({ value: 'blocked' });
    }
    void _expectTriggerRejected;
  });

  it('should reject nonexistent and invalid internal event descriptors', () => {
    createMachine({
      schemas: {
        events: {
          foo: z.object({}),
          'change.value': z.object({ value: z.string() })
        }
      },
      // @ts-expect-error
      internalEvents: ['nonexistent'] as const
    });

    createMachine({
      schemas: {
        events: {
          foo: z.object({}),
          'change.value': z.object({ value: z.string() })
        }
      },
      // @ts-expect-error
      internalEvents: ['foo.*.invalid'] as const
    });
  });
});

describe('context', () => {
  it('defined context in createMachine() should be an object', () => {
    createMachine({
      // @ts-expect-error
      context: 'string'
    });
  });

  it('context should be required if present in types', () => {
    createMachine({
      // types: {} as {
      //   context: { count: number };
      // }
      schemas: {
        // @ts-expect-error
        context: z.object({
          count: z.number()
        })
      }
    });

    createMachine({
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

    createMachine({
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
    const machine = createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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

    const m = createMachine({
      schemas: {
        emitted: {
          onClick: z.object({
            x: z.number(),
            y: z.number()
          }),
          onChange: z.object({})
        }
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

    const actorRef: ActorRefFromLogic<typeof m> = actor;

    actorRef.on('onClick', (ev) => {
      ev.y satisfies number;

      // @ts-expect-error
      ev.y satisfies string;
    });

    // @ts-expect-error
    actorRef.on('unknown', () => {});
  });
});

it('should not use actions as possible inference sites', () => {
  createMachine({
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
  createMachine({
    // types: {
    //   context: {} as {
    //     literalTest: 'foo' | 'bar';
    //   }
    // },
    schemas: {
      // @ts-expect-error
      context: z.object({
        literalTest: z.union([z.literal('foo'), z.literal('bar')])
      })
    },
    context: {
      literalTest: 'anything'
    }
  });
});

it('should infer context type from config.context when no schemas.context is provided', () => {
  const machine = createMachine({
    context: { count: 0, name: 'test' },
    initial: 'idle',
    states: {
      idle: {
        entry: ({ context }) => {
          ((_accept: number) => {})(context.count);
          ((_accept: string) => {})(context.name);
          // @ts-expect-error
          ((_accept: string) => {})(context.count);
        }
      }
    }
  });
});

it('should expose schemas on machine', () => {
  const schemas = {
    context: z.object({
      count: z.number()
    }),
    events: {
      inc: z.object({
        by: z.number()
      })
    },
    emitted: {
      changed: z.object({
        value: z.number()
      })
    }
  };
  const machine = createMachine({
    schemas,
    context: {
      count: 0
    }
  });

  machine.schemas?.context satisfies StandardSchemaV1 | undefined;
  machine.schemas?.events?.inc satisfies StandardSchemaV1 | undefined;
  machine.schemas?.emitted?.changed satisfies StandardSchemaV1 | undefined;
});

it('should expose non-context schemas on machine', () => {
  const schemas = {
    events: {
      inc: z.object({
        by: z.number()
      })
    }
  };
  const machine = createMachine({
    schemas,
    context: {
      count: 0
    }
  });

  machine.schemas?.events?.inc satisfies StandardSchemaV1 | undefined;
});

it('should expose schemas on setup return', () => {
  const s = setup({
    schemas: {
      context: z.object({
        count: z.number()
      }),
      events: {
        inc: z.object({
          by: z.number()
        })
      },
      actions: {
        track: {
          params: z.object({
            key: z.string()
          })
        }
      },
      guards: {
        hasAccess: {
          params: z.object({
            role: z.string()
          })
        }
      },
      emitted: {
        changed: z.object({
          value: z.number()
        })
      },
      input: z.object({
        start: z.number()
      }),
      output: z.object({
        total: z.number()
      }),
      meta: z.object({
        label: z.string()
      }),
      tags: z.literal('active'),
      children: {
        child: z.custom<AnyActorRef>()
      }
    }
  });

  s.schemas.context satisfies StandardSchemaV1;
  s.schemas.events.inc satisfies StandardSchemaV1;
  s.schemas.actions.track.params satisfies StandardSchemaV1;
  s.schemas.guards.hasAccess.params satisfies StandardSchemaV1;
  s.schemas.emitted.changed satisfies StandardSchemaV1;
  s.schemas.input satisfies StandardSchemaV1;
  s.schemas.output satisfies StandardSchemaV1;
  s.schemas.meta satisfies StandardSchemaV1;
  s.schemas.tags satisfies StandardSchemaV1;
  s.schemas.children.child satisfies StandardSchemaV1;
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

    createMachine({
      // types: {} as {
      //   events: { type: 'TOGGLE_ITALIC' } | { type: 'TOGGLE_BOLD' };
      // },
      schemas: {
        events: {
          TOGGLE_ITALIC: z.object({}),
          TOGGLE_BOLD: z.object({})
        }
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

    createMachine({
      schemas: {
        events: {
          TOGGLE_ITALIC: z.object({}),
          TOGGLE_BOLD: z.object({})
        }
      },
      type: 'parallel',
      // @ts-expect-error
      states: {
        underline: underlineState
      }
    });
  });
});

describe('events', () => {
  it('should not use actions as possible inference sites 1', () => {
    const machine = createMachine({
      // types: {
      //   events: {} as {
      //     type: 'FOO';
      //   }
      // },
      schemas: {
        events: {
          FOO: z.object({})
        }
      },
      entry: (_, enq) => enq.raise({ type: 'FOO' })
    });

    const service = createActor(machine).start();

    service.send({ type: 'FOO' });
    // @ts-expect-error
    service.send({ type: 'UNKNOWN' });
  });

  it('should not use actions as possible inference sites 2', () => {
    const machine = createMachine({
      // types: {
      //   events: {} as {
      //     type: 'FOO';
      //   }
      // },
      schemas: {
        events: {
          FOO: z.object({})
        }
      },
      entry: (_, enq) => enq.raise({ type: 'FOO' })
    });

    const service = createActor(machine).start();

    service.send({ type: 'FOO' });
    // @ts-expect-error
    service.send({ type: 'UNKNOWN' });
  });

  it('event type should be inferable from a simple state machine type', () => {
    const toggleMachine = createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        }),
        events: {
          TOGGLE: z.object({})
        }
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
    createMachine({
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
        events: {
          EVENT_WITH_FLAG: z.object({ flag: z.boolean() }),
          EVENT_WITHOUT_FLAG: z.object({})
        }
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
    createMachine({
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
        events: {
          EVENT_WITH_FLAG: z.object({ flag: z.boolean() }),
          EVENT_WITHOUT_FLAG: z.object({})
        }
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
    createMachine({
      // types: {} as {
      //   events:
      //     | { type: 'mouse.click.up'; direction: 'up' }
      //     | { type: 'mouse.click.down'; direction: 'down' }
      //     | { type: 'mouse.move' }
      //     | { type: 'mouse' }
      //     | { type: 'keypress' };
      // },
      schemas: {
        events: {
          'mouse.click.up': z.object({ direction: z.literal('up') }),
          'mouse.click.down': z.object({ direction: z.literal('down') }),
          'mouse.move': z.object({}),
          mouse: z.object({}),
          keypress: z.object({})
        }
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
    createMachine({
      // types: {} as {
      //   events:
      //     | { type: 'mouse.click.up'; direction: 'up' }
      //     | { type: 'mouse.click.down'; direction: 'down' }
      //     | { type: 'mouse.move' }
      //     | { type: 'mouse' }
      //     | { type: 'keypress' };
      // },
      schemas: {
        events: {
          'mouse.click.up': z.object({ direction: z.literal('up') }),
          'mouse.click.down': z.object({ direction: z.literal('down') }),
          'mouse.move': z.object({}),
          mouse: z.object({}),
          keypress: z.object({})
        }
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
    createMachine({
      // types: {} as {
      //   events:
      //     | { type: 'mouse.click.up'; direction: 'up' }
      //     | { type: 'mouse.click.down'; direction: 'down' }
      //     | { type: 'mouse.move' }
      //     | { type: 'mouse' }
      //     | { type: 'keypress' };
      // },
      schemas: {
        events: {
          'mouse.click.up': z.object({ direction: z.literal('up') }),
          'mouse.click.down': z.object({ direction: z.literal('down') }),
          'mouse.move': z.object({}),
          mouse: z.object({}),
          keypress: z.object({})
        }
      },
      on: {
        'mouse.doubleClick': {}
      }
    });
  });

  it('should not allow a transition using an event type matching the possible prefix but one that is outside of the defines ones', () => {
    createMachine({
      // types: {} as {
      //   events:
      //     | { type: 'mouse.click.up'; direction: 'up' }
      //     | { type: 'mouse.click.down'; direction: 'down' }
      //     | { type: 'mouse.move' }
      //     | { type: 'mouse' }
      //     | { type: 'keypress' };
      // },
      schemas: {
        events: {
          'mouse.click.up': z.object({ direction: z.literal('up') }),
          'mouse.click.down': z.object({ direction: z.literal('down') }),
          'mouse.move': z.object({}),
          mouse: z.object({}),
          keypress: z.object({})
        }
      },
      on: {
        'mouse.doubleClick': {}
      }
    });
  });

  it(`should infer inline function parameter only using a direct match when the transition descriptor doesn't has a trailing wildcard`, () => {
    createMachine({
      schemas: {
        events: {
          'mouse.click.up': z.object({ direction: z.literal('up') }),
          'mouse.click.down': z.object({ direction: z.literal('down') }),
          'mouse.move': z.object({}),
          mouse: z.object({}),
          keypress: z.object({})
        }
      },
      on: {
        mouse: ({ event }) => {
          ((_accept: 'mouse') => {})(event.type);
          // @ts-expect-error
          ((_accept: 'not any') => {})(event.type);
        }
      }
    });
  });

  it('should not allow a transition using a partial descriptor related to an event type that is only defined exxactly', () => {
    createMachine({
      schemas: {
        events: {
          'mouse.click.up': z.object({ direction: z.literal('up') }),
          'mouse.click.down': z.object({ direction: z.literal('down') }),
          'mouse.move': z.object({}),
          mouse: z.object({}),
          keypress: z.object({})
        }
      },
      on: {
        'keypress.*': {}
      }
    });
  });

  it('should provide the default TEvent to transition actions when there is no specific TEvent configured', () => {
    createMachine({
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

  it('should reject string target shorthand in transition configs', () => {
    createMachine({
      initial: 'a',
      // @ts-expect-error
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {}
      }
    });
  });

  it('should type context mappers on object transition configs', () => {
    const worker = createAsyncLogic({
      schemas: {
        output: types<{ answer: number }>()
      },
      run: async () => ({ answer: 42 })
    });

    setup({
      schemas: {
        context: types<{ value: number; memory: number[] }>(),
        events: {
          GO: types<{ value: number }>()
        }
      },
      actorSources: {
        worker
      }
    }).createMachine({
      context: { value: 0, memory: [] },
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: {
              target: 'done',
              context: ({ context, event }) => {
                const value: number = event.value;
                const memory: number[] = context.memory;
                // @ts-expect-error
                const invalid: string = event.value;

                noop(value);
                noop(memory);
                noop(invalid);

                return {
                  value,
                  memory: [...memory, value]
                };
              }
            }
          },
          invoke: {
            src: 'worker',
            onDone: {
              target: 'done',
              context: ({ output }) => {
                const answer: number = output.answer;
                // @ts-expect-error
                const invalid: string = output.answer;

                noop(answer);
                noop(invalid);

                return { value: answer };
              }
            }
          }
        },
        done: {}
      }
    });

    setup({
      schemas: {
        context: types<{ value: number }>(),
        events: {
          GO: types<{ value: number }>()
        }
      }
    }).createMachine({
      context: { value: 0 },
      initial: 'done',
      on: {
        // @ts-expect-error transition function results accept context patches, not context mappers
        GO: () => ({
          target: 'done',
          context: ({ event }: any) => ({ value: event.value })
        })
      },
      states: {
        done: {}
      }
    });
  });

  it('should provide contextual `event` type in transition actions when the matching event has a union `.type`', () => {
    createMachine({
      schemas: {
        events: {
          FOO: z.object({ value: z.string() }),
          OTHER: z.object({})
        }
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
      createMachine({
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
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: {
        child
      },
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child);
        enq.spawn(
          // @ts-expect-error
          actorSources.other
        );
      }
    });
  });

  it('should accept a defined actor at usage site', () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: {
        child
      },
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child);
      }
    });
  });

  it('should allow valid configured actor id', () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actorSources: {
        child
      },
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, { id: 'ok1' });
      }
    });
  });

  it('should disallow invalid actor id', () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   'child',
      //   {
      //     id: 'child'
      //   }
      // )
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, { id: 'child' });
      }
    });
  });

  it('should require id to be specified when it was configured', () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry:
      //   // @ts-expect-error
      //   spawnChild('child')
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child);
      }
    });
  });

  it(`shouldn't require id to be specified when it was not configured`, () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild('child')
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child);
      }
    });
  });

  it(`should allow id to be specified when it was not configured`, () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild('child', { id: 'someId' })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, { id: 'someId' });
      }
    });
  });

  it(`should allow anonymous inline actor outside of the configured actors`, () => {
    const child1 = createMachine({
      context: {
        counter: 0
      } as any
    });

    const child2 = createMachine({
      context: {
        answer: ''
      } as any
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child1;
      //   };
      // },
      actorSources: { child1 },
      // entry: spawnChild(child2)
      entry: ({ actorSources }, enq) => {
        enq.spawn(child2);
      }
    });
  });

  it(`should disallow anonymous inline actor with an id outside of the configured actors`, () => {
    const child1 = createMachine({
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      }
    });

    const child2 = createMachine({
      schemas: {
        context: z.object({
          answer: z.string()
        })
      },
      context: {
        answer: ''
      }
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child1;
      //     id: 'myChild';
      //   };
      // },
      actorSources: { child1 },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   child2,
      //   { id: 'myChild' }
      // )
      entry: ({ actorSources }, enq) => {
        enq.spawn(child2, { id: 'myChild' });
      }
    });
  });

  it(`should reject static wrong input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   'child',
      //   {
      //     input: 'hello'
      //   }
      // )
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          // @ts-expect-error
          input: 'hello'
        });
      }
    });
  });

  it(`should allow static correct input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild('child', {
      //   input: 42
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          input: 42
        });
      }
    });
  });

  it(`should allow static input that is a subtype of the expected one`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number | string }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild('child', {
      //   input: 42
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          input: 42
        });
      }
    });
  });

  it(`should reject static input that is a supertype of the expected one`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   'child',
      //   {
      //     input: Math.random() > 0.5 ? 'string' : 42
      //   }
      // )
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          // @ts-expect-error
          input: Math.random() > 0.5 ? 'string' : 42
        });
      }
    });
  });

  it(`should reject dynamic wrong input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   'child',
      //   {
      //     input: () => 'hello'
      //   }
      // )
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          // @ts-expect-error
          input: 'hello'
        });
      }
    });
  });

  it(`should allow dynamic correct input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild('child', {
      //   input: () => 42
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          input: 42
        });
      }
    });
  });

  it(`should reject dynamic input that is a supertype of the expected one`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild(
      //   // @ts-expect-error
      //   'child',
      //   {
      //     input: () => (Math.random() > 0.5 ? 42 : 'hello')
      //   }
      // )
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          // @ts-expect-error
          input: Math.random() > 0.5 ? 42 : 'hello'
        });
      }
    });
  });

  it(`should allow dynamic input that is a subtype of the expected one`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number | string }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: spawnChild('child', {
      //   input: () => 'hello'
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          input: 'hello'
        });
      }
    });
  });

  it(`should reject a valid input of a different provided actor`, () => {
    const child1 = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve(100)
    });

    const child2 = createAsyncLogic({
      run: ({}: { input: string }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources:
      //     | {
      //         src: 'child1';
      //         logic: typeof child1;
      //       }
      //     | {
      //         src: 'child2';
      //         logic: typeof child2;
      //       };
      // },
      actorSources: { child1, child2 },
      // entry:
      //   // @ts-expect-error
      //   spawnChild('child1', {
      //     input: 'hello'
      //   })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child1, {
          // @ts-expect-error
          input: 'hello'
        });
      }
    });
  });

  it(`should require input to be specified when it is required`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve(100)
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child');
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child);
      }
    });
  });

  it(`should not require input when it's optional`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number | undefined }) => Promise.resolve(100)
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child');
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child);
      }
    });
  });
});

describe('spawner in assign', () => {
  it('should reject actor outside of the defined ones at usage site', () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('other');
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(
          // @ts-expect-error
          actorSources.other
        );
        return {};
      }
    });
  });

  it('should accept a defined actor at usage site', () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child');
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child);
        return {};
      }
    });
  });

  it('should allow valid configured actor id', () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
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
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child', {
      //     id: 'child'
      //   });
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, { id: 'child' });
        return {};
      }
    });
  });

  it('should require id to be specified when it was configured', () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child');
      //   return {};
      // })
      entry: (_, enq) => {
        enq.spawn(child);
        return {};
      }
    });
  });

  it(`shouldn't require id to be specified when it was not configured`, () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
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
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
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
    const child1 = createMachine({
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      }
    });

    const child2 = createMachine({
      schemas: {
        context: z.object({
          answer: z.string()
        })
      },
      context: {
        answer: ''
      }
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child1;
      //   };
      // },
      actorSources: { child1 },
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
    const child1 = createMachine({
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      }
    });

    const child2 = createMachine({
      schemas: {
        context: z.object({
          answer: z.string()
        })
      },
      context: {
        answer: ''
      }
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child1;
      //     id: 'myChild';
      //   };
      // },
      actorSources: { child1 },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn(child2, { id: 'myChild' });
      //   return {};
      // })
      entry: (_, enq) => {
        enq.spawn(child2, { id: 'myChild' });
        return {};
      }
    });
  });

  it(`should reject static wrong input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child', {
      //     input: 'hello'
      //   });
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          // @ts-expect-error
          input: 'hello'
        });
        return {};
      }
    });
  });

  it(`should allow static correct input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child', {
      //     input: 42
      //   });
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          input: 42
        });
        return {};
      }
    });
  });

  it(`should allow static input that is a subtype of the expected one`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number | string }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child', {
      //     input: 42
      //   });
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          input: 42
        });
        return {};
      }
    });
  });

  it(`should reject static input that is a supertype of the expected one`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child', {
      //     input: Math.random() > 0.5 ? 'string' : 42
      //   });
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          // @ts-expect-error
          input: Math.random() > 0.5 ? 'string' : 42
        });
        return {};
      }
    });
  });

  it(`should reject an attempt to provide dynamic input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child, {
          // @ts-expect-error
          input: () => 42
        });
        return {};
      }
    });
  });

  it(`should return a concrete actor ref type based on actor logic argument, one that is assignable to a location expecting that concrete actor ref type`, () => {
    const child = createMachine({
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

    createMachine({
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
    const child = createMachine({
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

    const otherChild = createMachine({
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

    createMachine({
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
        const otherChildRef = enq.spawn(otherChild);
        // @ts-expect-error
        const childRef: ActorRefFrom<typeof child> = otherChildRef;
        childRef;

        return {
          context: {
            myChild: undefined
          }
        };
      }
    });
  });

  it(`should require input to be specified when it is required`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve(100)
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   // @ts-expect-error
      //   spawn('child');
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child);
      }
    });
  });

  it(`should not require input when it's optional`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number | undefined }) => Promise.resolve(100)
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // entry: assign(({ spawn }) => {
      //   spawn('child');
      //   return {};
      // })
      entry: ({ actorSources }, enq) => {
        enq.spawn(actorSources.child);
      }
    });
  });
});

describe('invoke', () => {
  it('should reject actor outside of the defined ones at usage site', () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: ({ actorSources }) =>
          // @ts-expect-error
          actorSources.other
      }
    });
  });

  it('should accept a defined actor at usage site', () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: ({ actorSources }) => actorSources.child
      }
    });
  });

  it('should accept a string actor logic reference', () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      actorSources: { child },
      invoke: {
        src: 'child'
      }
    });
  });

  it('should infer async logic input and output from source schemas', () => {
    createAsyncLogic({
      schemas: {
        input: types<{ userId: string }>(),
        output: types<{ name: string }>()
      },
      run: async ({ input }) => {
        const userId: string = input.userId;

        // @ts-expect-error
        input.age;

        return { name: userId };
      }
    });

    createAsyncLogic({
      // @ts-expect-error
      schemas: {
        input: types<{ userId: string }>(),
        output: types<{ name: string }>()
      },
      run: async () => {
        return { age: 42 };
      }
    });
  });

  it('should strongly type registered invoke input from async logic schemas', () => {
    const loadUser = createAsyncLogic({
      schemas: {
        input: types<{ userId: string }>(),
        output: types<{ name: string }>()
      },
      run: async ({ input }) => {
        return { name: input.userId };
      }
    });
    const output: OutputFrom<typeof loadUser> = { name: 'David' };
    // @ts-expect-error
    const wrongOutput: OutputFrom<typeof loadUser> = { age: 42 };

    noop(output);
    noop(wrongOutput);

    setup({
      actorSources: { loadUser }
    }).createMachine({
      invoke: {
        src: ({ actorSources }) => actorSources.loadUser,
        input: { userId: '42' },
        onDone: ({ event, output }) => {
          const name: string = output.name;

          noop(event.output);
          noop(name);
          noop(output);
        }
      }
    });

    const typedOnDone: TransitionConfigFunction<
      {},
      DoneActorEvent<{ name: string }>,
      EventObject,
      EventObject,
      any,
      any,
      any,
      any,
      any
    > = ({ output }) => {
      const name: string = output.name;
      // @ts-expect-error
      const age: number = output.age;

      noop(name);
      noop(age);
    };

    noop(typedOnDone);

    const typedCustomOutputEvent: TransitionConfigFunction<
      {},
      { type: 'custom'; output: { name: string } },
      EventObject,
      EventObject,
      any,
      any,
      any,
      any,
      any
    > = ({ output }) => {
      const undefinedOutput: undefined = output;
      // @ts-expect-error
      const name: string = output.name;

      noop(undefinedOutput);
      noop(name);
    };

    noop(typedCustomOutputEvent);

    setup({
      actorSources: { loadUser }
    }).createMachine({
      // @ts-expect-error
      invoke: {
        src: 'loadUserTypo',
        input: { userId: '42' }
      }
    });

    setup({
      actorSources: { loadUser }
    }).createMachine({
      // @ts-expect-error
      invoke: {
        src: 'loadUser',
        input: { userId: 42 }
      }
    });
  });

  it('should infer async logic output from run with input-only schemas', () => {
    const logic = createAsyncLogic({
      schemas: {
        input: types<{ name: string }>()
      },
      run: async ({ input }) => {
        const name: string = input.name;
        // @ts-expect-error
        const age: number = input.age;

        noop(name);
        noop(age);

        return { message: input.name };
      }
    });

    const output: OutputFrom<typeof logic> = { message: 'ok' };
    const message: string = output.message;
    // @ts-expect-error
    const wrongOutput: OutputFrom<typeof logic> = { other: 'nope' };

    noop(output);
    noop(message);
    noop(wrongOutput);

    setup({
      actorSources: { logic }
    }).createMachine({
      initial: 'Idle',
      states: {
        Idle: {
          invoke: {
            src: 'logic',
            input: { name: 'David' },
            onDone: ({ event, output }) => {
              const eventMessage: string = event.output.message;
              const outputMessage: string = output.message;
              // @ts-expect-error
              const missing: number = event.output.missing;

              noop(eventMessage);
              noop(outputMessage);
              noop(missing);
            }
          }
        }
      }
    });

    setup({
      actorSources: { logic }
    }).createMachine({
      // @ts-expect-error
      invoke: {
        src: 'logic',
        input: { name: 42 }
      }
    });
  });

  it('should narrow transition function events by keyed event', () => {
    setup({
      schemas: {
        events: {
          REJECT: types<{ reason: string }>(),
          APPROVE: types<{}>()
        }
      }
    }).createMachine({
      on: {
        REJECT: ({ event }) => {
          const reason: string = event.reason;
          // @ts-expect-error
          event.missing;
          noop(reason);
        },
        APPROVE: ({ event }) => {
          // @ts-expect-error
          event.reason;
        }
      }
    });
  });

  it('should allow eventless setup machines to be assigned to AnyStateMachine', () => {
    const machine = setup({
      schemas: {
        context: types<{ value: string }>(),
        input: types<{ value: string }>(),
        output: types<{ value: string }>()
      }
    }).createMachine({
      context: ({ input }) => ({ value: input.value }),
      output: ({ context }) => ({ value: context.value }),
      initial: 'done',
      states: {
        done: { type: 'final' }
      }
    });

    const anyMachine: AnyStateMachine = machine;
    noop(anyMachine);
  });

  it('should allow invoked eventless setup machines to be assigned to any logic types', () => {
    const step = createAsyncLogic({
      schemas: {
        input: z.object({ value: z.string() }),
        output: z.object({ value: z.string() })
      },
      run: async ({ input }) => input
    });

    const machine = setup({
      schemas: {
        context: z.object({ value: z.string() }),
        input: z.object({ value: z.string() }),
        output: z.object({ value: z.string() }),
        events: {}
      },
      actorSources: {
        step
      }
    }).createMachine({
      context: ({ input }) => ({ value: input.value }),
      output: ({ context }) => ({ value: context.value }),
      initial: 'running',
      states: {
        running: {
          invoke: {
            src: 'step',
            input: ({ context }) => context,
            onDone: { target: 'done' }
          }
        },
        done: { type: 'final' }
      }
    });

    const anyLogic: AnyActorLogic = machine;
    const anyMachine: AnyStateMachine = machine;

    noop(anyLogic);
    noop(anyMachine);

    const actor = createActor(machine);
    const anyActorRef: AnyActorRef = actor;
    const anySnapshot: AnyMachineSnapshot = actor.getSnapshot();

    toPromise(actor);

    noop(anyActorRef);
    noop(anySnapshot);

    actor.send(
      // @ts-expect-error empty events means no external events
      { type: 'ANYTHING' }
    );
  });

  it('should preserve contextual typing when setup returns are decorated', () => {
    const loadUser = createAsyncLogic({
      schemas: {
        input: types<{ userId: string }>(),
        output: types<{ name: string }>()
      },
      run: async ({ input }) => {
        return { name: input.userId };
      }
    });
    const loadOrg = createAsyncLogic({
      schemas: {
        output: types<{ org: string }>()
      },
      run: async () => {
        return { org: 'Stately' };
      }
    });

    const decorateSetup = <const TConfig extends AnySetupConfig>(
      config: TConfig
    ): SetupReturnFromConfig<TConfig> & { extra: true } => {
      const s = setup(config) as SetupReturnFromConfig<TConfig>;

      return Object.assign(s, { extra: true as const });
    };

    const s = decorateSetup({
      schemas: {
        context: z.object({
          prompt: z.string()
        }),
        events: {
          SUBMIT: z.object({
            value: z.string()
          })
        }
      },
      actorSources: {
        loadUser,
        loadOrg
      }
    });

    s.createMachine({
      context: {
        prompt: ''
      },
      invoke: {
        src: 'loadUser',
        input: ({ context }) => ({
          userId: context.prompt
        }),
        onDone: ({ event, output }) => {
          const eventName: string = event.output.name;
          const outputName: string = output.name;
          // @ts-expect-error
          const age: number = output.age;
          // @ts-expect-error
          const org: string = output.org;

          noop(eventName);
          noop(outputName);
          noop(age);
          noop(org);
        }
      },
      on: {
        SUBMIT: ({ context, event }) => {
          const prompt: string = context.prompt;
          const value: string = event.value;
          // @ts-expect-error
          event.missing;

          noop(prompt);
          noop(value);

          return {
            context: {
              prompt: value
            }
          };
        }
      }
    });

    const extra: true = s.extra;
    noop(extra);
  });

  it('should infer empty Zod v4 event schemas as type-only events', () => {
    const machine = setup({
      schemas: {
        events: {
          SEND: z4.object({}),
          UPDATE: z4.object({
            value: z4.string()
          })
        }
      }
    }).createMachine({});

    const actor = createActor(machine);

    actor.send({ type: 'SEND' });
    actor.send({ type: 'UPDATE', value: 'ok' });
    // @ts-expect-error
    actor.send({ type: 'UPDATE' });
  });

  it('should infer void and undefined event schemas as type-only events', () => {
    const machine = setup({
      schemas: {
        events: {
          SEND: types<void>(),
          RESET: types<undefined>(),
          UPDATE: types<{ value: string }>()
        }
      }
    }).createMachine({});

    const actor = createActor(machine).start();
    const snapshot = actor.getSnapshot();

    actor.send({ type: 'SEND' });
    actor.send({ type: 'RESET' });
    snapshot.can({ type: 'SEND' });
    snapshot.can({ type: 'RESET' });

    actor.send({ type: 'UPDATE', value: 'ok' });
    snapshot.can({ type: 'UPDATE', value: 'ok' });
    // @ts-expect-error
    actor.send({ type: 'UPDATE' });
    // @ts-expect-error
    snapshot.can({ type: 'UPDATE' });

    const emittedMachine = setup({
      schemas: {
        emitted: {
          DONE: types<void>(),
          CLEARED: types<undefined>(),
          CHANGED: types<{ value: string }>()
        }
      }
    }).createMachine({});

    const emittedActor = createActor(emittedMachine);

    emittedActor.on('DONE', (event) => {
      event.type satisfies 'DONE';
      // @ts-expect-error
      event.value;
    });
    emittedActor.on('CLEARED', (event) => {
      event.type satisfies 'CLEARED';
      // @ts-expect-error
      event.value;
    });
    emittedActor.on('CHANGED', (event) => {
      event.value satisfies string;
    });
    // @ts-expect-error
    emittedActor.on('UNKNOWN', () => {});
  });

  it('should infer callback logic input from source schemas', () => {
    const logic = createCallbackLogic({
      schemas: {
        input: types<{ userId: string }>()
      },
      run: ({ input }) => {
        const userId: string = input.userId;

        // @ts-expect-error
        input.age;

        noop(userId);
      }
    });

    const input: InputFrom<typeof logic> = { userId: '42' };
    // @ts-expect-error
    const wrongInput: InputFrom<typeof logic> = { userId: 42 };

    noop(input);
    noop(wrongInput);
  });

  it('should infer observable logic input from source schemas', () => {
    const logic = createObservableLogic({
      schemas: {
        input: types<{ period: number }>()
      },
      run: ({ input }) => {
        const period: number = input.period;

        // @ts-expect-error
        input.userId;

        return from([period]);
      }
    });

    const input: InputFrom<typeof logic> = { period: 100 };
    // @ts-expect-error
    const wrongInput: InputFrom<typeof logic> = { period: '100' };

    noop(input);
    noop(wrongInput);
  });

  it('should infer event observable logic input from source schemas', () => {
    const logic = createEventObservableLogic({
      schemas: {
        input: types<{ eventType: 'ready' }>()
      },
      run: ({ input }) => {
        const eventType: 'ready' = input.eventType;

        // @ts-expect-error
        input.period;

        return from([{ type: eventType }]);
      }
    });

    const input: InputFrom<typeof logic> = { eventType: 'ready' };
    // @ts-expect-error
    const wrongInput: InputFrom<typeof logic> = { eventType: 'idle' };

    noop(input);
    noop(wrongInput);
  });

  it('should infer custom logic input and output from source schemas', () => {
    const logic = createLogic({
      schemas: {
        input: types<{ step: number }>(),
        output: types<{ total: number }>()
      },
      context: ({ input }) => {
        const step: number = input.step;

        // @ts-expect-error
        input.userId;

        return { count: step };
      },
      run: ({
        context,
        event
      }: {
        context: { count: number };
        event: { type: 'inc' } | { type: 'done' };
      }) => {
        if (event.type === 'inc') {
          return { context: { count: context.count + 1 } };
        }

        return {
          status: 'done',
          output: { total: context.count }
        };
      }
    });

    const input: InputFrom<typeof logic> = { step: 1 };
    // @ts-expect-error
    const wrongInput: InputFrom<typeof logic> = { step: '1' };
    const output: OutputFrom<typeof logic> = { total: 1 };
    // @ts-expect-error
    const wrongOutput: OutputFrom<typeof logic> = { count: 1 };

    noop(input);
    noop(wrongInput);
    noop(output);
    noop(wrongOutput);
  });

  it('should reject an unknown string actor logic reference', () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      actorSources: { child },
      // @ts-expect-error
      invoke: {
        src: 'other'
      }
    });
  });

  it('should allow a string actor logic reference when no actors object exists', () => {
    createMachine({
      invoke: {
        src: 'child'
      }
    });
  });

  it('should allow valid configured actor id', () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        id: 'ok1',
        src: ({ actorSources }) => actorSources.child
      }
    });
  });

  it('should disallow invalid actor id', () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        id: 'child',
        src: ({ actorSources }) => actorSources.child
      }
    });
  });

  it('should require id to be specified when it was configured', () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'ok1' | 'ok2';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: ({ actorSources }) => actorSources.child
      }
    });
  });

  it(`shouldn't require id to be specified when it was not configured`, () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: ({ actorSources }) => actorSources.child
      }
    });
  });

  it(`should allow id to be specified when it was not configured`, () => {
    const child = createMachine({});

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        id: 'someId',
        src: ({ actorSources }) => actorSources.child
      }
    });
  });

  it(`should allow anonymous inline actor outside of the configured actors`, () => {
    const child1 = createMachine({
      context: {
        counter: 0
      } as any
    });

    const child2 = createMachine({
      context: {
        answer: ''
      } as any
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child1;
      //   };
      // },
      actorSources: { child1 },
      invoke: {
        src: child2
      }
    });
  });

  it(`should diallow anonymous inline actor with an id outside of the configured actors`, () => {
    const child1 = createMachine({
      context: {
        counter: 0
      } as any
    });

    const child2 = createMachine({
      context: {
        answer: ''
      } as any
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child1;
      //     id: 'myChild';
      //   };
      // },
      actorSources: { child1 },
      invoke: {
        src: child2,
        id: 'myChild'
      }
    });
  });

  it(`should reject static wrong input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // @ts-expect-error - static input is checked against the logic's input type
      invoke: {
        src: ({ actorSources }) => actorSources.child,
        input: 'hello'
      }
    });
  });

  it(`should allow static correct input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: ({ actorSources }) => actorSources.child,
        input: 42
      }
    });
  });

  it(`should allow static input that is a subtype of the expected one`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number | string }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: ({ actorSources }) => actorSources.child,
        input: 42
      }
    });
  });

  it(`should reject static input that is a supertype of the expected one`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // @ts-expect-error - static input is checked against the logic's input type
      invoke: {
        src: ({ actorSources }) => actorSources.child,
        input: Math.random() > 0.5 ? 'string' : 42
      }
    });
  });

  it(`should reject dynamic wrong input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: (({ actorSources }: any) => actorSources.child) as any,
        input: () => 'hello'
      }
    });
  });

  it(`should allow dynamic correct input`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: ({ actorSources }) => actorSources.child,
        input: () => 42
      }
    });
  });

  it(`should reject dynamic input that is a supertype of the expected one`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      // @ts-expect-error - input mapper is checked against the logic's input type
      invoke: {
        src: ({ actorSources }) => actorSources.child,
        input: () => (Math.random() > 0.5 ? 42 : 'hello')
      }
    });
  });

  it(`should allow dynamic input that is a subtype of the expected one`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number | string }) => Promise.resolve('foo')
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: ({ actorSources }) => actorSources.child,
        input: () => 'hello'
      }
    });
  });

  it(`should require input to be specified when it is required`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve(100)
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: ({ actorSources }) => actorSources.child
      }
    });
  });

  it(`should not require input when it's optional`, () => {
    const child = createAsyncLogic({
      run: ({}: { input: number | undefined }) => Promise.resolve(100)
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        src: ({ actorSources }) => actorSources.child
      }
    });
  });
});

describe('actor implementations', () => {
  it('should reject actor outside of the defined ones in provided implementations', () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: { child }
    }).provide({
      actorSources: {
        // @ts-expect-error
        other: child
      }
    });
  });

  it('should accept a defined actor in provided implementations', () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: { child }
    }).provide({
      actorSources: {
        child
      }
    });
  });

  it(`should reject the provided actor when the output doesn't match`, () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: { child }
    }).provide({
      actorSources: {
        // @ts-expect-error
        child: createAsyncLogic({ run: () => Promise.resolve(42) })
      }
    });
  });

  it(`should reject the provided actor when its output is a super type of the expected one`, () => {
    const child = createAsyncLogic({ run: () => Promise.resolve('foo') });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: { child }
    }).provide({
      actorSources: {
        // @ts-expect-error
        child: createAsyncLogic({
          run: () => Promise.resolve(Math.random() > 0.5 ? 'foo' : 42)
        })
      }
    });
  });

  it(`should accept the provided actor when its output is a sub type of the expected one`, () => {
    const child = createAsyncLogic({
      run: () => Promise.resolve(Math.random() > 0.5 ? 'foo' : 42)
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        child: createAsyncLogic({ run: () => Promise.resolve('foo') })
      }
    });
  });

  it(`should reject the provided actor when its input is a sub type of the expected one`, () => {
    const child = createAsyncLogic({
      schemas: {
        input: types<{ userId: string }>()
      },
      run: async () => {}
    });

    createMachine({
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        // @ts-expect-error
        child: createAsyncLogic({
          schemas: {
            input: types<{ userId: 'fixed' }>()
          },
          run: async () => {}
        })
      }
    });
  });

  it(`should accept the provided actor when its input is a super type of the expected one`, () => {
    const child = createAsyncLogic({
      schemas: {
        input: types<{ userId: string }>()
      },
      run: async () => {}
    });

    createMachine({
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        child: createAsyncLogic({
          schemas: {
            input: types<{ userId: string | number }>()
          },
          run: async () => {}
        })
      }
    });
  });

  it('should allow an actor with the expected snapshot type', () => {
    const child = createMachine({
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

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        child
      }
    });
  });

  it('should reject an actor with an incorrect snapshot type', () => {
    const child = createMachine({
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

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        // @ts-expect-error
        child: createMachine({
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
    const child = createMachine({
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

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        // TODO: ideally this should be allowed
        child: createMachine({
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
    const child = createMachine({
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

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        // @ts-expect-error
        child: createMachine({
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
    const child = createMachine({
      schemas: {
        events: {
          EV_1: z.object({})
        }
      }
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        child
      }
    });
  });

  it('should reject an actor with wrong event types', () => {
    const child = createMachine({
      // types: {} as {
      //   events: {
      //     type: 'EV_1';
      //   };
      // }
      schemas: {
        events: {
          EV_1: z.object({})
        }
      }
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        // @ts-expect-error
        child: createMachine({
          // types: {} as {
          //   events: {
          //     type: 'OTHER';
          //   };
          // }
          schemas: {
            events: {
              OTHER: z.object({})
            }
          }
        })
      }
    });
  });

  it('should reject an actor with an event type that is a subtype of the expected one', () => {
    const child = createMachine({
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
        events: {
          EV_1: z.object({}),
          EV_2: z.object({})
        }
      }
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        // the provided actor has to be able to handle all the event types that it might receive from the parent here
        // @ts-expect-error
        child: createMachine({
          // types: {} as {
          //   events: {
          //     type: 'EV_1';
          //   };
          // }
          schemas: {
            events: {
              EV_1: z.object({})
            }
          }
        })
      }
    });
  });

  it('should allow an actor with a snapshot type that is a supertype of the expected one', () => {
    const child = createMachine({
      // types: {} as {
      //   events: {
      //     type: 'EV_1';
      //   };
      // }
      schemas: {
        events: {
          EV_1: z.object({})
        }
      }
    });

    createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    }).provide({
      actorSources: {
        child: createMachine({
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
            events: {
              EV_1: z.object({}),
              EV_2: z.object({})
            }
          }
        })
      }
    });
  });
});

describe('state.children without setup', () => {
  it('should return the correct child type on the available snapshot when the child ID for the actor was configured', () => {
    const child = createMachine({
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

    const machine = createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'someChild';
      //     logic: typeof child;
      //   };
      // },
      actorSources: { child },
      invoke: {
        id: 'someChild',
        src: ({ actorSources }) => actorSources.child
      }
    });

    const snapshot = createActor(machine).getSnapshot();
    const childSnapshot = snapshot.children.someChild!.getSnapshot();

    childSnapshot.context.foo satisfies string | undefined;
    childSnapshot.context.foo satisfies string;
    childSnapshot.context.foo satisfies '';
    childSnapshot.context.foo satisfies number | undefined;
  });

  it('should have an optional child on the available snapshot when the child ID for the actor was configured', () => {
    const child = createMachine({
      context: {
        counter: 0
      } as any
    });

    const machine = createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     id: 'myChild';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    });

    const childActor = createActor(machine).getSnapshot().children.myChild;

    childActor satisfies ActorRefFrom<typeof child> | undefined;
    childActor satisfies ActorRefFrom<typeof child>;
  });

  it('should have an optional child on the available snapshot when the child ID for the actor was not configured', () => {
    const child = createMachine({
      context: {
        counter: 0
      } as any
    });

    const machine = createMachine({
      // types: {} as {
      //   actorSources: {
      //     src: 'child';
      //     logic: typeof child;
      //   };
      // }
      actorSources: {
        child
      }
    });

    const childActor = createActor(machine).getSnapshot().children.someChild;

    childActor satisfies ActorRefFrom<typeof child> | undefined;
    childActor satisfies ActorRefFrom<typeof child>;
  });

  it('should not have an index signature on the available snapshot when child IDs were configured for all actors', () => {
    const child1 = createMachine({
      context: {
        counter: 0
      } as any
    });

    const child2 = createMachine({
      context: {
        answer: ''
      } as any
    });

    const machine = createMachine({
      // types: {} as {
      //   actorSources:
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
      actorSources: {
        child1,
        child2
      }
    });

    createActor(machine).getSnapshot().children.counter;
    createActor(machine).getSnapshot().children.quiz;
    createActor(machine).getSnapshot().children.someChild;
  });

  it('should have an index signature on the available snapshot when child IDs were configured only for some actors', () => {
    const child1 = createMachine({
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      }
    });

    const child2 = createMachine({
      schemas: {
        context: z.object({
          answer: z.string()
        })
      },
      context: {
        answer: ''
      }
    });

    const machine = createMachine({
      // types: {} as {
      //   actorSources:
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
      actorSources: {
        child1,
        child2
      }
      // TODO: children schema
    });

    const counterActor = createActor(machine).getSnapshot().children.counter;
    counterActor satisfies ActorRefFrom<typeof child1> | undefined;

    const someActor = createActor(machine).getSnapshot().children.someChild;
    someActor satisfies ActorRefFrom<typeof child2> | undefined;
    someActor satisfies
      | ActorRefFrom<typeof child1>
      | ActorRefFrom<typeof child2>
      | undefined;
  });
});

describe('actions', () => {
  it('context should get inferred for builtin actions used as an entry action', () => {
    createMachine({
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
    createMachine({
      // types: {
      //   context: {} as { count: number },
      //   events: {} as { type: 'FOO' } | { type: 'BAR' }
      // },
      schemas: {
        context: z.object({
          count: z.number()
        }),
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
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
    createMachine({
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
    createMachine({
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
        // @ts-expect-error TS7 reports the rejected schema overload here too
        events: {
          TOGGLE: z.object({})
        },
        // @ts-expect-error TS7 reports the rejected schema overload here too
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      //   actions: { type: 'greet'; params: { name: string } } | { type: 'poke' };
      // },
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
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

describe('setup.extend', () => {
  it('should infer action and guard params from setup schemas', () => {
    setup({
      schemas: {
        actions: {
          track: {
            params: z.object({ key: z.string() })
          }
        },
        guards: {
          hasAccess: {
            params: z.object({ role: z.string() })
          }
        }
      }
    }).createMachine({
      initial: 'idle',
      on: {
        GO: ({ actions, guards }, enq) => {
          actions.track({ key: 'abc' });
          enq(actions.track, { key: 'abc' });
          // @ts-expect-error action param key must be a string
          actions.track({ key: 100 });

          if (guards.hasAccess({ role: 'admin' })) {
            return { target: '.done' };
          }
          guards.hasAccess({
            // @ts-expect-error guard param role must be a string
            role: 100
          });
        }
      },
      states: {
        idle: {},
        done: {}
      }
    });
  });

  it('should infer action and guard params from machine schemas', () => {
    setup().createMachine({
      schemas: {
        actions: {
          track: {
            params: z.object({ key: z.string() })
          }
        },
        guards: {
          hasAccess: {
            params: z.object({ role: z.string() })
          }
        }
      },
      initial: 'idle',
      on: {
        GO: ({ actions, guards }, enq) => {
          actions.track({ key: 'abc' });
          enq(actions.track, { key: 'abc' });
          // @ts-expect-error action param key must be a string
          enq(actions.track, { key: 100 });

          if (guards.hasAccess({ role: 'admin' })) {
            return { target: '.done' };
          }
          guards.hasAccess({
            // @ts-expect-error guard param role must be a string
            role: 100
          });
        }
      },
      states: {
        idle: {},
        done: {}
      }
    });
  });

  it('extends action, guard, and delay maps', () => {
    const s = setup({
      actions: {
        base: (params: { value: string }) => {}
      },
      guards: {
        isBase: () => true
      },
      delays: {
        short: 1
      }
    }).extend({
      actions: {
        extended: (params: { count: number }) => {}
      },
      guards: {
        isExtended: () => true
      },
      delays: {
        long: 2
      }
    });

    s.createMachine({
      initial: 'a',
      actions: {
        local: (params: { ok: boolean }) => {}
      },
      on: {
        NEXT: ({ guards }) => {
          if (guards.isBase() && guards.isExtended()) {
            return { target: '.b' };
          }
        }
      },
      states: {
        a: {
          entry: ({ actions }, enq) => {
            enq(actions.base, { value: 'ok' });
            enq(actions.extended, { count: 1 });
            actions.local({ ok: true });
            actions.local({
              // @ts-expect-error
              ok: 'no'
            });
            actions.base({
              // @ts-expect-error
              value: 1
            });
            enq(
              // @ts-expect-error
              actions.missing
            );
          },
          after: {
            short: { target: 'b' },
            long: { target: 'b' }
          }
        },
        b: {}
      }
    });
  });
});

describe('choice state types', () => {
  it('should accept a choice function', () => {
    createMachine({
      context: {
        isVip: false
      },
      initial: 'routing',
      states: {
        routing: {
          type: 'choice',
          choice: ({ context }) => {
            const isVip: boolean = context.isVip;

            // @ts-expect-error
            const invalid: string = context.isVip;

            noop(isVip);
            noop(invalid);

            return {
              target: context.isVip ? 'vip' : 'standard'
            };
          }
        },
        vip: {},
        standard: {}
      }
    });
  });

  it('should infer context for no-event setup choice states', () => {
    setup({
      schemas: {
        context: z.object({
          isVip: z.boolean()
        })
      }
    }).createMachine({
      context: {
        isVip: false
      },
      initial: 'routing',
      states: {
        routing: {
          type: 'choice',
          choice: ({ context }) => {
            const isVip: boolean = context.isVip;

            // @ts-expect-error
            const invalid: string = context.isVip;

            noop(isVip);
            noop(invalid);

            return {
              target: context.isVip ? 'vip' : 'standard'
            };
          }
        },
        vip: {},
        standard: {}
      }
    });
  });

  it('should reject an array of choices', () => {
    const invalidArray: AnyNextStateNodeConfig = {
      type: 'choice',
      // @ts-expect-error - `choice` must be a function
      choice: [{ target: 'done' }]
    };

    noop(invalidArray);
  });

  it('should reject normal state capabilities on choice states', () => {
    // @ts-expect-error
    const invalidOn: AnyNextStateNodeConfig = {
      type: 'choice',
      choice: () => ({ target: 'done' }),
      on: {
        NEXT: { target: 'done' }
      }
    };

    // @ts-expect-error
    const invalidInvoke: AnyNextStateNodeConfig = {
      type: 'choice',
      choice: () => ({ target: 'done' }),
      invoke: {
        src: createAsyncLogic({ run: async () => undefined })
      }
    };

    noop(invalidOn);
    noop(invalidInvoke);
  });
});

describe('children schemas', () => {
  const child = createMachine({
    schemas: {
      events: {
        PING: z.object({ value: z.string() })
      }
    },
    on: {
      PING: {}
    }
  });

  const invalidChild = createMachine({
    schemas: {
      events: {
        PONG: z.object({ count: z.number() })
      }
    },
    on: {
      PONG: {}
    }
  });

  it('should type declared child refs from schemas.children', () => {
    setup({}).createMachine({
      schemas: {
        children: {
          someId: z.custom<ActorRefFromLogic<typeof child>>()
        }
      },
      invoke: {
        id: 'someId',
        src: child
      },
      initial: 'active',
      states: {
        active: {
          on: {
            CHECK: ({ children }) => {
              children.someId?.send({ type: 'PING', value: 'ok' });

              // @ts-expect-error
              children.someId?.send({ type: 'PING', value: 42 });
              // @ts-expect-error
              children.someId?.send({ type: 'PONG', count: 1 });
              // @ts-expect-error
              children.other;
            }
          }
        }
      }
    });
  });

  it('should reject an incompatible inline invoke src for a declared child id', () => {
    createMachine({
      schemas: {
        children: {
          someId: z.custom<ActorRefFromLogic<typeof child>>()
        }
      },
      // @ts-expect-error
      invoke: {
        id: 'someId',
        src: invalidChild
      }
    });

    setup({}).createMachine({
      schemas: {
        children: {
          someId: z.custom<ActorRefFromLogic<typeof child>>()
        }
      },
      // @ts-expect-error
      invoke: {
        id: 'someId',
        src: invalidChild
      }
    });
  });

  it('should reject an incompatible registered invoke src for a declared child id', () => {
    setup({}).createMachine({
      schemas: {
        children: {
          someId: z.custom<ActorRefFromLogic<typeof child>>()
        }
      },
      actorSources: {
        invalidChild
      },
      // @ts-expect-error
      invoke: {
        id: 'someId',
        src: 'invalidChild'
      }
    });
  });
});

describe('input', () => {
  it('should provide the input type to the context factory', () => {
    createMachine({
      schemas: {
        input: z.object({
          count: z.number()
        })
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
    const machine = createMachine({
      schemas: {
        input: z.object({
          count: z.number()
        })
      }
    });

    createActor(machine, { input: { count: 100 } });
  });

  it('should reject invalid input type when interpreting an actor', () => {
    const machine = createMachine({
      schemas: {
        input: z.object({
          count: z.number()
        })
      }
    });

    createActor(machine, {
      input: {
        count: ''
      }
    });
  });

  it('should require input to be specified when defined', () => {
    const machine = createMachine({
      schemas: {
        input: z.object({
          count: z.number()
        })
      }
    });

    createActor(machine);
  });

  it('should not require input when not defined', () => {
    const machine = createMachine({});

    createActor(machine);
  });

  it('should create actors from provided no-event setup machines', () => {
    const child = createMachine({});
    const machine = setup({
      schemas: {
        context: z.object({
          count: z.number()
        }),
        input: z.object({
          count: z.number()
        }),
        output: z.object({
          count: z.number()
        })
      },
      actorSources: {
        child
      }
    }).createMachine({
      context: ({ input }) => ({
        count: input.count
      }),
      initial: 'active',
      states: {
        active: {}
      }
    });

    const provided = machine.provide({
      actorSources: {
        child
      }
    });

    const anyLogic: AnyActorLogic = provided;
    const anyMachine: AnyStateMachine = provided;

    noop(anyLogic);
    noop(anyMachine);

    createActor(provided, {
      input: { count: 1 }
    });
  });

  it('should infer context for no-event always transitions', () => {
    setup({
      schemas: {
        context: z.object({
          count: z.number()
        })
      }
    }).createMachine({
      context: {
        count: 0
      },
      initial: 'active',
      states: {
        active: {
          always: ({ context }) => {
            const count: number = context.count;

            // @ts-expect-error
            const invalid: string = context.count;

            noop(count);
            noop(invalid);

            return {
              target: context.count > 0 ? 'done' : 'idle'
            };
          }
        },
        idle: {},
        done: {}
      }
    });
  });

  it('should reject invalid declared events', () => {
    const machine = createMachine({
      schemas: {
        events: {
          PING: z.object({
            value: z.string()
          })
        }
      }
    });

    createActor(machine).send({ type: 'PING', value: 'ok' });

    // @ts-expect-error
    createActor(machine).send({ type: 'PONG' });
  });
});

describe('guards', () => {
  it('should allow a defined parameterized guard with params', () => {
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
    const machine = createMachine({
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
    createMachine({
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

  it('should disallow dynamic params that return invalid params type', () => {
    createMachine({
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
    createMachine({
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
  it('should accept delays in provide', () => {
    createMachine({
      delays: {
        short: 100
      },
      initial: 'idle',
      states: {
        idle: {
          after: {
            short: { target: 'done' }
          }
        },
        done: {}
      }
    }).provide({
      delays: {
        short: 1,
        // @ts-expect-error
        unknown: 100
      }
    });
  });

  it('should accept a plain number as key of an after transitions object when delays are declared', () => {
    createMachine({
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
    createMachine({
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
    // @ts-expect-error
    createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      after: {
        'unknown delay': { target: '.done' }
      },
      initial: 'done',
      states: {
        done: {}
      }
    });
  });

  it('should reject timeout delay strings outside of the defined ones', () => {
    createMachine({
      delays: {
        short: 100
      },
      // @ts-expect-error
      timeout: 'unknown delay',
      onTimeout: {}
    });
  });

  it('should reject nested after delay strings outside of the defined ones', () => {
    // @ts-expect-error
    createMachine({
      delays: {
        short: 100
      },
      initial: 'idle',
      states: {
        idle: {
          after: {
            unknown: { target: 'done' }
          }
        },
        done: {}
      }
    });
  });

  it('should reject setup-created machine delay strings outside of the defined ones', () => {
    // @ts-expect-error
    setup({}).createMachine({
      delays: {
        short: 100
      },
      after: {
        short: { target: '.done' },
        unknown: { target: '.done' }
      },
      initial: 'done',
      states: {
        done: {}
      }
    });
  });

  it('should reject setup-created machine timeout delay strings outside of the defined ones', () => {
    setup({}).createMachine({
      delays: {
        short: 100
      },
      // @ts-expect-error
      timeout: 'unknown delay',
      onTimeout: {}
    });
  });

  it('should accept a plain number as delay in `raise` when delays are declared', () => {
    createMachine({
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
    createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      // entry: raise({ type: 'FOO' }, { delay: 'one minute' })
      entry: (_, enq) => {
        enq.raise({ type: 'FOO' }, { delay: 'one minute' as any });
      }
    });
  });

  it('should reject a delay outside of the defined ones in `raise`', () => {
    createMachine({
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
    const otherActor = createActor(createMachine({}));

    createMachine({
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

  it('should type enq.sendTo events against context actor refs', () => {
    const child = createMachine({
      schemas: {
        events: {
          PING: z.object({
            type: z.literal('PING'),
            value: z.number()
          })
        }
      }
    });

    createMachine({
      schemas: {
        context: z.object({
          child: z.custom<ActorRefFrom<typeof child>>()
        })
      },
      context: ({ spawn }) => ({
        child: spawn(child)
      }),
      entry: ({ context }, enq) => {
        enq.sendTo(context.child, { type: 'PING', value: 42 });
        // @ts-expect-error
        enq.sendTo(context.child, { type: 'PONG' });
      }
    });
  });

  it('should return typed actor refs from enq.spawn', () => {
    const child = createMachine({
      schemas: {
        events: {
          PING: z.object({
            type: z.literal('PING')
          })
        }
      }
    });

    createMachine({
      entry: (_, enq) => {
        const childRef = enq.spawn(child);

        childRef.send({ type: 'PING' });
        // @ts-expect-error
        childRef.send({ type: 'PONG' });
      }
    });
  });

  it('should accept a defined delay in `sendTo`', () => {
    const otherActor = createActor(createMachine({}));

    createMachine({
      // types: {} as {
      //   delays: 'one second' | 'one minute';
      // },
      delays: {
        'one second': 1000,
        'one minute': 60000
      },
      // entry: sendTo(otherActor, { type: 'FOO' }, { delay: 'one minute' })
      entry: (_, enq) => {
        enq.sendTo(otherActor, { type: 'FOO' }, { delay: 'one minute' as any });
      }
    });
  });

  it('should reject a delay outside of the defined ones in `sendTo`', () => {
    const otherActor = createActor(createMachine({}));

    createMachine({
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
    createMachine({
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
    createMachine({
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
        enq.raise({ type: 'FOO' }, { delay: 'one minute' as any });
      }
    });
  });

  it('should reject a delay outside of the defined ones in `raise` in `enqueueActions`', () => {
    createMachine({
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
    createMachine({
      after: {
        just_any_delay: {}
      } as any
    });
  });
});

describe('tags', () => {
  it(`should NOT allow a defined tag when it's set using a string`, () => {
    createMachine({
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
    createMachine({
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
    createMachine({
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
    createMachine({
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
      tags: ['other'] as any
    });
  });

  it('`hasTag` should allow checking a defined tag', () => {
    const machine = createMachine({
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
    const machine = createMachine({
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

describe('createCallbackLogic', () => {
  it('should reject a start callback that returns an explicit promise', () => {
    createMachine({
      invoke: {
        src: createCallbackLogic(
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
    // createCallbackLogic(async ({ sendBack }) => {
    //   const api = await getSomeWebApi(); // async function was used to conveniently use `await` here
    //
    //   // this didn't work as expected because this promise was completing almost asap
    //   // so the parent was never able to receive those events sent to it
    //   api.addEventListener('some_event', () => sendBack({ type: 'EV' }))
    //
    //   // implicit completion
    // })
    createMachine({
      invoke: {
        src: createCallbackLogic(
          // @ts-ignore
          async () => {}
        )
      }
    });
  });

  it('should reject a start callback that returns a non-function and non-undefined value', () => {
    createMachine({
      invoke: {
        src: createCallbackLogic(
          // @ts-ignore
          () => {
            return 42;
          }
        )
      }
    });
  });

  it('should allow returning an implicit undefined from the start callback', () => {
    createMachine({
      invoke: {
        src: createCallbackLogic(() => {})
      }
    });
  });

  it('should allow returning an explicit undefined from the start callback', () => {
    createMachine({
      invoke: {
        src: createCallbackLogic(() => {
          return undefined;
        })
      }
    });
  });

  it('should allow returning a cleanup function the start callback', () => {
    createMachine({
      invoke: {
        src: createCallbackLogic(() => {
          return undefined;
        })
      }
    });
  });
});

describe('self', () => {
  it('should accept correct event types in an inline entry custom action', () => {
    createMachine({
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
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
    createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
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
    createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
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
    createMachine({
      // types: {} as {
      //   events: { type: 'FOO' } | { type: 'BAR' };
      // },
      schemas: {
        events: {
          FOO: z.object({}),
          BAR: z.object({})
        }
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
    createMachine({
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
    createMachine({
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
    const logic = createAsyncLogic({
      run: ({}: { input: number }) => Promise.resolve(100)
    });

    createActor(logic);
  });

  it(`should not require input when it's optional`, () => {
    const logic = createAsyncLogic({
      run: ({}: { input: number | undefined }) => Promise.resolve(100)
    });

    createActor(logic);
  });
});

describe('snapshot methods', () => {
  it('should allow repeated matches checks with negative narrowing', () => {
    const machine = setup({
      schemas: { context: types<{ id: string }>() }
    }).createMachine({
      context: { id: '' },
      initial: 'loading',
      states: { loading: {}, loaded: {}, failed: {} }
    });

    type Snap = SnapshotFrom<typeof machine>;

    const a = (s: Snap) => s.matches('loaded');
    const b = (s: Snap) => [s.matches('loaded'), s.matches('failed')];
    const c = (s: Snap) => s.matches('loaded') || s.matches('failed');
    const d = (s: Snap) => !s.matches('loaded') && !s.matches('failed');
    const e = (s: Snap, value: StateValue) =>
      s.matches(value) || s.matches('failed');

    void [a, b, c, d, e];
  });

  it('should allow repeated matches checks with nested state values', () => {
    const machine = createMachine({
      initial: 'red',
      states: {
        red: {
          initial: 'walk',
          states: {
            walk: {},
            wait: {}
          }
        },
        green: {}
      }
    });

    type Snap = SnapshotFrom<typeof machine>;

    const parent = (s: Snap) => s.matches('red') || s.matches('green');
    const children = (s: Snap) =>
      s.matches({ red: 'walk' }) || s.matches({ red: 'wait' });

    void [parent, children];
  });

  it('should type infer actor union snapshot methods', () => {
    const typeOne = createMachine({
      schemas: {
        events: {
          one: z.object({})
        },
        tags: z.union([z.literal('one'), z.literal('two')])
      },
      initial: 'one',
      states: {
        one: {}
      }
    });
    type TypeOneRef = ActorRefFrom<typeof typeOne>;

    const typeTwo = createMachine({
      schemas: {
        events: {
          one: z.object({}),
          two: z.object({})
        },
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
    snapshot.hasTag('two');
    // @ts-expect-error
    snapshot.hasTag('three');

    snapshot.matches('one');
    snapshot.matches('two');
    snapshot.matches('three');

    snapshot.getMeta();
    snapshot.toJSON();
  });
});

// https://github.com/statelyai/xstate/issues/4931
it('createAsyncLogic should not have issues with actors with emitted types', () => {
  // const machine = setup({
  //   types: {
  //     emitted: {} as { type: 'FOO' }
  //   }
  // }).createMachine({});
  const machine = createMachine({
    schemas: {
      emitted: {
        FOO: z.object({
          type: z.literal('FOO')
        })
      }
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
  const logic = createMachine({});

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

it('createSystem registry keys typecheck registryKey usage', () => {
  const receiver = createCallbackLogic<{ type: 'HELLO' }>(() => {});
  const other = createCallbackLogic<{ type: 'OTHER' }>(() => {});
  const app = createSystem({
    registry: {
      receiver
    }
  });

  app.setup().createMachine({
    invoke: {
      src: receiver,
      registryKey: 'receiver'
    }
  });

  app
    .setup({
      actorSources: {
        receiver
      }
    })
    .createMachine({
      invoke: {
        src: 'receiver',
        registryKey: 'receiver'
      }
    });

  app.setup().createMachine({
    // @ts-expect-error unknown system key
    invoke: {
      src: receiver,
      registryKey: 'missing'
    }
  });

  app
    .setup({
      actorSources: {
        other
      }
    })
    .createMachine({
      invoke: {
        src: 'other',
        // @ts-expect-error system key expects the registered logic
        registryKey: 'receiver'
      }
    });

  app.setup().createMachine({
    on: {
      test: ({ system }, enq) => {
        system.get('receiver')?.send({ type: 'HELLO' });
        // @ts-expect-error registry key expects a HELLO event
        system.get('receiver')?.send({ type: 'OTHER' });
        enq.spawn(receiver, { registryKey: 'receiver' });
        // @ts-expect-error registry key expects the registered logic
        enq.spawn(other, { registryKey: 'receiver' });
      }
    }
  });

  if (false) {
    app.createActor(receiver, { registryKey: 'receiver' });
    // @ts-expect-error registry key expects the registered logic
    app.createActor(other, { registryKey: 'receiver' });
  }
});
