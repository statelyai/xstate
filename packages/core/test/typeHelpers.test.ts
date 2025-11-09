import z from 'zod';
import {
  ActorLogic,
  ActorRefFrom,
  ContextFrom,
  EventFrom,
  MachineImplementationsFrom,
  Snapshot,
  SnapshotFrom,
  StateValueFrom,
  TagsFrom,
  createActor,
  createMachine
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
        events: z.union([
          z.object({ type: z.literal('UPDATE_NAME'), value: z.string() }),
          z.object({ type: z.literal('UPDATE_AGE'), value: z.number() }),
          z.object({ type: z.literal('ANOTHER_EVENT') })
        ])
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
        events: z.union([
          z.object({ type: z.literal('UPDATE_NAME'), value: z.string() }),
          z.object({ type: z.literal('UPDATE_AGE'), value: z.number() }),
          z.object({ type: z.literal('ANOTHER_EVENT') })
        ])
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

describe('MachineImplementationsFrom', () => {
  it('should return implementations for a machine', () => {
    const machine = createMachine({
      context: {
        count: 100
      },
      schemas: {
        context: z.object({
          count: z.number()
        }),
        events: z.union([
          z.object({ type: z.literal('FOO') }),
          z.object({ type: z.literal('BAR'), value: z.string() })
        ])
      },
      actions: {
        foo: (_num: number) => 'hello'
      }
    });

    const acceptMachineImplementations = (
      _options: MachineImplementationsFrom<typeof machine>
    ) => {};

    acceptMachineImplementations({
      actions: {
        foo: (num: number) => 'hello'
      },
      actors: {},
      guards: {},
      delays: {}
    });

    // @ts-expect-error
    acceptMachineImplementations(100);
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
          events: z.object({ type: z.literal('FOO') })
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
      transition: (state) => state,
      getInitialSnapshot: () => ({
        status: 'active',
        output: undefined,
        error: undefined
      }),
      getPersistedSnapshot: (s) => s
    };

    function acceptActorRef(actorRef: ActorRefFrom<typeof logic>) {
      actorRef.send({ type: 'TEST' });
    }

    acceptActorRef(createActor(logic).start());
  });
});

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
