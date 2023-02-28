import { createMachine } from 'xstate';
import { getMachineShortestPaths } from '../';

describe('types', () => {
  it('`getEvents` should be allowed to return a mutable array', () => {
    const machine = createMachine<unknown, { type: 'FOO' } | { type: 'BAR' }>(
      {}
    );

    getMachineShortestPaths(machine, {
      events: [
        {
          type: 'FOO'
        }
      ]
    });
  });

  it('`getEvents` should be allowed to return a readonly array', () => {
    const machine = createMachine<unknown, { type: 'FOO' } | { type: 'BAR' }>(
      {}
    );

    getMachineShortestPaths(machine, {
      events: [
        {
          type: 'FOO'
        }
      ]
    });
  });

  it('`eventCases` should allow known event', () => {
    const machine = createMachine<unknown, { type: 'FOO'; value: number }>({});

    getMachineShortestPaths(machine, {
      events: [
        {
          type: 'FOO',
          value: 100
        }
      ]
    });
  });

  it('`eventCases` should not require all event types', () => {
    const machine = createMachine<
      unknown,
      { type: 'FOO'; value: number } | { type: 'BAR'; value: number }
    >({});

    getMachineShortestPaths(machine, {
      events: [{ type: 'FOO', value: 100 }]
    });
  });

  it('`eventCases` should not allow unknown events', () => {
    const machine = createMachine<unknown, { type: 'FOO'; value: number }>({});

    getMachineShortestPaths(machine, {
      events: [
        {
          type: 'UNKNOWN',
          value: 100
        } as any
      ]
    });
  });

  it('`eventCases` should only allow props of a specific event', () => {
    const machine = createMachine<
      unknown,
      { type: 'FOO'; value: number } | { type: 'BAR'; other: string }
    >({});

    getMachineShortestPaths(machine, {
      events: [
        {
          type: 'FOO',
          // @ts-expect-error
          other: 'nana nana nananana'
        }
      ]
    });
  });

  it('`serializeEvent` should be allowed to return plain string', () => {
    const machine = createMachine({});

    getMachineShortestPaths(machine, {
      serializeEvent: () => ''
    });
  });

  it('`serializeState` should be allowed to return plain string', () => {
    const machine = createMachine({});

    getMachineShortestPaths(machine, {
      serializeState: () => ''
    });
  });
});
