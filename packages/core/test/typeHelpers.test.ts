import {
  assign,
  ContextFrom,
  createMachine,
  SnapshotFrom,
  EventFrom,
  interpret,
  MachineImplementationsFrom,
  StateValueFrom
} from '../src';
import { TypegenMeta } from '../src/typegenTypes';

describe('ContextFrom', () => {
  it('should return context of a machine', () => {
    const machine = createMachine({
      schema: {
        context: {} as { counter: number }
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
      tsTypes: {} as TypegenMeta,
      schema: {
        context: {} as { counter: number }
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
      schema: {
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
      tsTypes: {} as TypegenMeta,
      schema: {
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
      schema: {
        events: {} as
          | { type: 'UPDATE_NAME'; value: string }
          | { type: 'UPDATE_AGE'; value: number }
          | { type: 'ANOTHER_EVENT' }
      }
    });

    const service = interpret(machine);

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
      schema: {
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
        foo: assign((ctx) => {
          ((_accept: number) => {})(ctx.count);
          return {};
        })
      }
    });
    acceptMachineImplementations({
      actions: {
        foo: assign((_ctx, ev) => {
          ((_accept: 'FOO' | 'BAR') => {})(ev.type);
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
      tsTypes: {} as TypesMeta,
      context: {
        count: 100
      },
      schema: {
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
        myAction: assign((ctx, ev) => {
          ((_accept: number) => {})(ctx.count);
          ((_accept: 'FOO') => {})(ev.type);
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
      tsTypes: {} as TypesMeta,
      context: {
        count: 100
      },
      schema: {
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
        myAction: assign((ctx, ev) => {
          ((_accept: number) => {})(ctx.count);
          ((_accept: 'FOO') => {})(ev.type);
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
      tsTypes: {} as TypesMeta
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
    const service = interpret(
      createMachine({
        schema: {
          events: {} as { type: 'FOO' }
        }
      })
    );

    function acceptState(_state: SnapshotFrom<typeof service>) {}

    acceptState(service.initialState);
    // @ts-expect-error
    acceptState("isn't any");
  });
});
