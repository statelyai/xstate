import {
  assign,
  ContextFrom,
  createMachine,
  SnapshotFrom,
  EventFrom,
  createActor,
  MachineImplementationsFrom,
  StateValueFrom,
  ActorLogic,
  ActorRefFrom,
  TagsFrom,
  Snapshot
} from '../src/index.ts';
import { TypegenMeta } from '../src/typegenTypes';

describe('ContextFrom', () => {
  it('should return context of a machine', () => {
    const machine = createMachine({
      types: {
        context: {} as { counter: number }
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

  it('should return context of a typegened machine', () => {
    const machine = createMachine({
      types: {
        typegen: {} as TypegenMeta,
        context: {} as { counter: number }
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
      types: {
        events: {} as
          | { type: 'UPDATE_NAME'; value: string }
          | { type: 'UPDATE_AGE'; value: number }
          | { type: 'ANOTHER_EVENT' }
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

  it('should return events for a typegened machine', () => {
    const machine = createMachine({
      types: {
        typegen: {} as TypegenMeta,
        events: {} as
          | { type: 'UPDATE_NAME'; value: string }
          | { type: 'UPDATE_AGE'; value: number }
          | { type: 'ANOTHER_EVENT' }
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

  it('should return events for an interpreter', () => {
    const machine = createMachine({
      types: {
        events: {} as
          | { type: 'UPDATE_NAME'; value: string }
          | { type: 'UPDATE_AGE'; value: number }
          | { type: 'ANOTHER_EVENT' }
      }
    });

    const service = createActor(machine);

    type InterpreterEvent = EventFrom<typeof service>;

    const acceptInterpreterEvent = (_event: InterpreterEvent) => {};

    acceptInterpreterEvent({ type: 'UPDATE_NAME', value: 'test' });
    acceptInterpreterEvent({ type: 'UPDATE_AGE', value: 12 });
    acceptInterpreterEvent({ type: 'ANOTHER_EVENT' });
    acceptInterpreterEvent({
      // @ts-expect-error
      type: 'UNKNOWN_EVENT'
    });
  });
});

describe('MachineImplementationsFrom', () => {
  it('should return implementations for a typegen-less machine', () => {
    const machine = createMachine({
      context: {
        count: 100
      },
      types: {
        events: {} as { type: 'FOO' } | { type: 'BAR'; value: string }
      }
    });

    const acceptMachineImplementations = (
      _options: MachineImplementationsFrom<typeof machine>
    ) => {};

    acceptMachineImplementations({
      actions: {
        foo: () => {}
      }
    });
    acceptMachineImplementations({
      actions: {
        foo: assign(() => ({}))
      }
    });
    acceptMachineImplementations({
      actions: {
        foo: assign(({ context }) => {
          ((_accept: number) => {})(context.count);
          return {};
        })
      }
    });
    acceptMachineImplementations({
      actions: {
        foo: assign(({ event }) => {
          ((_accept: 'FOO' | 'BAR') => {})(event.type);
          return {};
        })
      }
    });
    // @ts-expect-error
    acceptMachineImplementations(100);
  });

  it('should return optional implementations for a typegen-based machine by default', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }
    const machine = createMachine({
      context: {
        count: 100
      },
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR'; value: string }
      }
    });

    const acceptMachineImplementations = (
      _options: MachineImplementationsFrom<typeof machine>
    ) => {};

    acceptMachineImplementations({
      actions: {
        // @ts-expect-error
        foo: () => {}
      }
    });
    acceptMachineImplementations({
      actions: {}
    });
    acceptMachineImplementations({
      actions: {
        myAction: assign(({ context, event }) => {
          ((_accept: number) => {})(context.count);
          ((_accept: 'FOO') => {})(event.type);
          return {};
        })
      }
    });
    // @ts-expect-error
    acceptMachineImplementations(100);
  });

  it('should return required implementations for a typegen-based machine with a flag', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        actors: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }
    const machine = createMachine({
      context: {
        count: 100
      },
      types: {
        typegen: {} as TypesMeta,
        events: {} as { type: 'FOO' } | { type: 'BAR'; value: string }
      }
    });

    const acceptMachineImplementations = (
      _options: MachineImplementationsFrom<typeof machine, true>
    ) => {};

    acceptMachineImplementations({
      actions: {
        // @ts-expect-error
        foo: () => {}
      }
    });
    acceptMachineImplementations({
      // @ts-expect-error
      actions: {}
    });
    acceptMachineImplementations({
      actions: {
        myAction: assign(({ context, event }) => {
          ((_accept: number) => {})(context.count);
          ((_accept: 'FOO') => {})(event.type);
          return {};
        })
      }
    });
    // @ts-expect-error
    acceptMachineImplementations(100);
  });
});

describe('StateValueFrom', () => {
  it('should return possible state values from a typegened machine', () => {
    interface TypesMeta extends TypegenMeta {
      matchesStates: 'a' | 'b' | 'c';
    }

    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta
      }
    });

    function matches(_value: StateValueFrom<typeof machine>) {}

    matches('a');
    matches('b');
    // @ts-expect-error
    matches('unknown');
  });

  it('should return any from a typegenless machine', () => {
    const machine = createMachine({});

    function matches(_value: StateValueFrom<typeof machine>) {}

    matches('just anything');
  });
});

describe('SnapshotFrom', () => {
  it('should return state type from a service that has concrete event type', () => {
    const service = createActor(
      createMachine({
        types: {
          events: {} as { type: 'FOO' }
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
      getInitialState: () => ({
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
  it('derives tags from StateMachine when typegen is enabled', () => {
    interface TypesMeta extends TypegenMeta {
      tags: 'a' | 'b' | 'c';
    }
    const machine = createMachine({
      types: {
        typegen: {} as TypesMeta
      }
    });

    type Tags = TagsFrom<typeof machine>;

    const acceptTag = (_tag: Tags) => {};

    acceptTag('a');
    acceptTag('b');
    acceptTag('c');
    // @ts-expect-error d is not a valid tag
    acceptTag('d');
  });

  it('derives string from StateMachine without typegen', () => {
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
