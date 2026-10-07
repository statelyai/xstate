import z from 'zod';
import {
  ActorLogic,
  ActorRefFrom,
  ContextFrom,
  EmittedFrom,
  ErrorFrom,
  EventFrom,
  MachineSourcesFrom,
  OutputFrom,
  Snapshot,
  SnapshotFrom,
  StateSchemaFrom,
  StateValueFrom,
  TagsFrom,
  createActor,
  createMachine,
  setup
} from '../src/index.ts';

describe('ContextFrom', () => {
  it('should return context of a machine', () => {
    const machine = createMachine({
      // types: {
      //   context: {} as { counter: number }
      // },
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      }
    });

    type MachineContext = ContextFrom<typeof machine>;

    const acceptMachineContext = (_event: MachineContext) => {};

    acceptMachineContext({ counter: 100 });
    acceptMachineContext({
      counter: 100,
      // @ts-expect-error
      other: 'unknown'
    });
    const obj = { completely: 'invalid' };
    // @ts-expect-error
    acceptMachineContext(obj);
  });
});

describe('EventFrom', () => {
  it('should return events for a machine', () => {
    const machine = createMachine({
      // types: {
      //   events: {} as
      //     | { type: 'UPDATE_NAME'; value: string }
      //     | { type: 'UPDATE_AGE'; value: number }
      //     | { type: 'ANOTHER_EVENT' }
      // }
      schemas: {
        events: {
          UPDATE_NAME: z.object({ value: z.string() }),
          UPDATE_AGE: z.object({ value: z.number() }),
          ANOTHER_EVENT: z.object({})
        }
      }
    });

    type MachineEvent = EventFrom<typeof machine>;

    const acceptMachineEvent = (_event: MachineEvent) => {};

    acceptMachineEvent({ type: 'UPDATE_NAME', value: 'test' });
    acceptMachineEvent({ type: 'UPDATE_AGE', value: 12 });
    acceptMachineEvent({ type: 'ANOTHER_EVENT' });
    acceptMachineEvent({
      // @ts-expect-error
      type: 'UNKNOWN_EVENT'
    });
  });

  it('should return events for an actor', () => {
    const machine = createMachine({
      schemas: {
        events: {
          UPDATE_NAME: z.object({ value: z.string() }),
          UPDATE_AGE: z.object({ value: z.number() }),
          ANOTHER_EVENT: z.object({})
        }
      }
    });

    const actor = createActor(machine);

    type ActorEvent = EventFrom<typeof actor>;

    const acceptActorEvent = (_event: ActorEvent) => {};

    acceptActorEvent({ type: 'UPDATE_NAME', value: 'test' });
    acceptActorEvent({ type: 'UPDATE_AGE', value: 12 });
    acceptActorEvent({ type: 'ANOTHER_EVENT' });
    acceptActorEvent({
      // @ts-expect-error
      type: 'UNKNOWN_EVENT'
    });
  });
});

describe('MachineSourcesFrom', () => {
  it('should return sources for a machine', () => {
    const machine = createMachine({
      context: {
        count: 100
      },
      schemas: {
        context: z.object({
          count: z.number()
        }),
        events: {
          FOO: z.object({}),
          BAR: z.object({ value: z.string() })
        }
      },
      actions: {
        foo: () => {}
      }
    });

    const acceptMachineSources = (
      _options: MachineSourcesFrom<typeof machine>
    ) => {};

    acceptMachineSources({
      actions: {
        foo: () => {}
      },
      actors: {},
      guards: {},
      delays: {}
    });

    // @ts-expect-error
    acceptMachineSources(100);
  });

  it('should reject an action that returns an arbitrary (non-void/assignment) value', () => {
    createMachine({
      actions: {
        // @ts-expect-error an action must return void or { context?, children? }
        foo: () => 'hello'
      }
    });
  });
});

describe('StateValueFrom', () => {
  it('should return any from a machine', () => {
    const machine = createMachine({});

    function matches(_value: StateValueFrom<typeof machine>) {}

    matches('just anything');
  });
});

describe('SnapshotFrom', () => {
  it('should return state type from a service that has concrete event type', () => {
    const service = createActor(
      createMachine({
        // types: {
        //   events: {} as { type: 'FOO' }
        // }
        schemas: {
          events: {
            FOO: z.object({})
          }
        }
      })
    );

    function acceptState(_state: SnapshotFrom<typeof service>) {}

    acceptState(service.getSnapshot());
    // @ts-expect-error
    acceptState("isn't any");
  });

  it('should return state from a machine without context', () => {
    const machine = createMachine({});

    function acceptState(_state: SnapshotFrom<typeof machine>) {}

    acceptState(createActor(machine).getSnapshot());
    // @ts-expect-error
    acceptState("isn't any");
  });

  it('should return state from a machine with context', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          counter: z.number()
        })
      },
      context: {
        counter: 0
      }
    });

    function acceptState(_state: SnapshotFrom<typeof machine>) {}

    acceptState(createActor(machine).getSnapshot());
    // @ts-expect-error
    acceptState("isn't any");
  });
});

describe('ActorRefFrom', () => {
  it('should return `ActorRef` based on actor logic', () => {
    const logic: ActorLogic<Snapshot<undefined>, { type: 'TEST' }> = {
      transition: (state) => [state, []],
      getInitialSnapshot: () => ({
        status: 'active',
        output: undefined,
        error: undefined
      }),
      initialTransition: () => [
        {
          status: 'active',
          output: undefined,
          error: undefined
        },
        []
      ],
      getPersistedSnapshot: (s) => s
    };

    function acceptActorRef(actorRef: ActorRefFrom<typeof logic>) {
      actorRef.send({ type: 'TEST' });
    }

    acceptActorRef(createActor(logic).start());
  });
});

describe('helpers for a machine with internal events', () => {
  type IsNever<T> = [T] extends [never] ? true : false;

  const machine = setup({
    schemas: {
      context: z.object({ count: z.number() }),
      events: { inc: z.object({ by: z.number() }) },
      internalEvents: { tick: z.object({}) },
      emitted: { saved: z.object({ count: z.number() }) },
      output: z.object({ count: z.number() })
    },
    actions: { log: () => {} }
  }).createMachine({
    context: { count: 0 },
    initial: 'counting',
    states: {
      counting: {
        on: {
          inc: ({ context, event }) => ({
            context: { count: context.count + event.by }
          }),
          tick: ({ context }) => ({ context: { count: context.count + 1 } })
        }
      }
    },
    output: ({ context }) => ({ count: context.count })
  });
  const actor = createActor(machine);
  type Ref = ActorRefFrom<typeof machine>;

  it('EventFrom returns the events of the machine', () => {
    const acceptEvent = (_event: EventFrom<typeof machine>) => {};
    acceptEvent({ type: 'inc', by: 1 });
    acceptEvent({ type: 'tick' });
    acceptEvent({
      // @ts-expect-error
      type: 'other'
    });

    const inc: EventFrom<typeof machine, 'inc'> = { type: 'inc', by: 1 };
    const refEvent: EventFrom<Ref> = { type: 'inc', by: 1 };
    noop(inc, refEvent);
  });

  it('ContextFrom returns the context of the machine and of its actor', () => {
    const acceptContext = (_context: ContextFrom<typeof machine>) => {};
    acceptContext({ count: 0 });
    acceptContext({
      // @ts-expect-error
      count: 'x'
    });

    const acceptActorContext = (_context: ContextFrom<typeof actor>) => {};
    acceptActorContext({ count: 0 });
    acceptActorContext({
      // @ts-expect-error
      count: 'x'
    });
  });

  it('helpers resolve through ActorRefFrom', () => {
    const context: SnapshotFrom<Ref>['context'] = { count: 0 };
    const output: OutputFrom<Ref> = { count: 0 };
    const error: ErrorFrom<Ref> = new Error('failed');
    noop(context, output, error);
  });

  it('machine helpers keep the machine types', () => {
    const stateSchemaIsNever: IsNever<StateSchemaFrom<typeof machine>> = false;
    const action: keyof MachineSourcesFrom<typeof machine>['actions'] = 'log';
    // @ts-expect-error
    const otherAction: keyof MachineSourcesFrom<typeof machine>['actions'] =
      'other';
    const emitted: EmittedFrom<typeof machine> = { type: 'saved', count: 1 };
    // @ts-expect-error
    const otherEmitted: EmittedFrom<typeof machine> = { type: 'other' };
    noop(stateSchemaIsNever, action, otherAction, emitted, otherEmitted);
  });
});

function noop(..._values: unknown[]) {}

describe('tags', () => {
  it('derives string from StateMachine', () => {
    const machine = createMachine({});

    type Tags = TagsFrom<typeof machine>;

    const acceptTag = (_tag: Tags) => {};

    acceptTag('a');
    acceptTag('b');
    acceptTag('c');
    // d is a valid tag, as is any string
    acceptTag('d');
  });
});
