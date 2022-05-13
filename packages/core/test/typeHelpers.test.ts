import {
  assign,
  ContextFrom,
  createMachine,
  EmittedFrom,
  EventFrom,
  interpret,
  MachineOptionsFrom,
  StateValueFrom
} from '../src';
import { createModel } from '../src/model';
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

  it('should return events for createModel', () => {
    const userModel = createModel(
      {},
      {
        events: {
          updateName: (value: string) => ({ value }),
          updateAge: (value: number) => ({ value }),
          anotherEvent: () => ({})
        }
      }
    );

    type UserModelEvent = EventFrom<typeof userModel>;

    const acceptUserModelEvent = (_event: UserModelEvent) => {};

    acceptUserModelEvent({ type: 'updateName', value: 'test' });
    acceptUserModelEvent({ type: 'updateAge', value: 12 });
    acceptUserModelEvent({ type: 'anotherEvent' });
    acceptUserModelEvent({
      // @ts-expect-error
      type: 'eventThatDoesNotExist'
    });
  });

  it('should narrow events down to the specified types', () => {
    const userModel = createModel(
      {},
      {
        events: {
          updateName: (value: string) => ({ value }),
          updateAge: (value: number) => ({ value }),
          anotherEvent: () => ({})
        }
      }
    );

    type UserModelEventSubset = EventFrom<
      typeof userModel,
      'updateName' | 'updateAge'
    >;

    const acceptUserModelEventSubset = (
      _userModelEventSubset: UserModelEventSubset
    ) => {};

    acceptUserModelEventSubset({ type: 'updateName', value: 'test' });
    acceptUserModelEventSubset({ type: 'updateAge', value: 12 });
    // @ts-expect-error
    acceptUserModelEventSubset({ type: 'anotherEvent' });
    // @ts-expect-error
    acceptUserModelEventSubset({ type: 'eventThatDoesNotExist' });
  });

  it('should correctly extract events from events having union of strings as their `type`', () => {
    const machine = createMachine({
      schema: {
        events: {} as { type: 'INC' | 'DEC' }
      }
    });

    type MachineEvent = EventFrom<typeof machine, 'INC'>;

    const acceptEvent = (_event: MachineEvent) => {};

    acceptEvent({ type: 'INC' });
  });
});

describe('MachineOptionsFrom', () => {
  it('should return options for a typegen-less machine', () => {
    const machine = createMachine({
      context: {
        count: 100
      },
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR'; value: string }
      }
    });

    const acceptMachineOptions = (
      _options: MachineOptionsFrom<typeof machine>
    ) => {};

    acceptMachineOptions({
      actions: {
        foo: () => {}
      }
    });
    acceptMachineOptions({
      actions: {
        foo: assign(() => ({}))
      }
    });
    acceptMachineOptions({
      actions: {
        foo: assign((ctx) => {
          ((_accept: number) => {})(ctx.count);
          return {};
        })
      }
    });
    acceptMachineOptions({
      actions: {
        foo: assign((_ctx, ev) => {
          ((_accept: 'FOO' | 'BAR') => {})(ev.type);
          return {};
        })
      }
    });
    // @ts-expect-error
    acceptMachineOptions(100);
  });

  it('should return optional options for a typegen-based machine by default', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        services: never;
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

    const acceptMachineOptions = (
      _options: MachineOptionsFrom<typeof machine>
    ) => {};

    acceptMachineOptions({
      actions: {
        // @ts-expect-error
        foo: () => {}
      }
    });
    acceptMachineOptions({
      actions: {}
    });
    acceptMachineOptions({
      actions: {
        myAction: assign((ctx, ev) => {
          ((_accept: number) => {})(ctx.count);
          ((_accept: 'FOO') => {})(ev.type);
          return {};
        })
      }
    });
    // @ts-expect-error
    acceptMachineOptions(100);
  });

  it('should return required options for a typegen-based machine with a flag', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        services: never;
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

    const acceptMachineOptions = (
      _options: MachineOptionsFrom<typeof machine, true>
    ) => {};

    acceptMachineOptions({
      actions: {
        // @ts-expect-error
        foo: () => {}
      }
    });
    acceptMachineOptions({
      // @ts-expect-error
      actions: {}
    });
    acceptMachineOptions({
      actions: {
        myAction: assign((ctx, ev) => {
          ((_accept: number) => {})(ctx.count);
          ((_accept: 'FOO') => {})(ev.type);
          return {};
        })
      }
    });
    // @ts-expect-error
    acceptMachineOptions(100);
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

describe('EmittedFrom', () => {
  it('should return state type from a service that has concrete event type', () => {
    const service = interpret(
      createMachine({
        schema: {
          events: {} as { type: 'FOO' }
        }
      })
    );

    function acceptState(_state: EmittedFrom<typeof service>) {}

    acceptState(service.initialState);
    // @ts-expect-error
    acceptState("isn't any");
  });

  it('should return state from a service created based on a model without any concrete events', () => {
    const service = interpret(
      createModel(
        {},
        {
          // this empty obj is important for this test case
        }
      ).createMachine({})
    );

    function acceptState(_state: EmittedFrom<typeof service>) {}

    acceptState(service.initialState);
    // @ts-expect-error
    acceptState("isn't any");
  });
});
