import { createMachine } from 'xstate';
import { getShortestPlans } from '../src/index.js';

describe('types', () => {
  it('`getEvents` should be allowed to return a mutable array', () => {
    const machine = createMachine<{}, { type: 'FOO' } | { type: 'BAR' }>({});

    getShortestPlans(machine, {
      getEvents: () => [
        {
          type: 'FOO'
        } as const
      ]
    });
  });

  it('`getEvents` should be allowed to return a readonly array', () => {
    const machine = createMachine<{}, { type: 'FOO' } | { type: 'BAR' }>({});

    getShortestPlans(machine, {
      getEvents: () =>
        [
          {
            type: 'FOO'
          }
        ] as const
    });
  });

  it('`eventCases` should allow known event', () => {
    const machine = createMachine<{}, { type: 'FOO'; value: number }>({});

    getShortestPlans(machine, {
      eventCases: {
        FOO: [
          {
            value: 100
          }
        ]
      }
    });
  });

  it('`eventCases` should not require all event types', () => {
    const machine = createMachine<
      {},
      { type: 'FOO'; value: number } | { type: 'BAR'; value: number }
    >({});

    getShortestPlans(machine, {
      eventCases: {
        FOO: [
          {
            value: 100
          }
        ]
      }
    });
  });

  it('`eventCases` should not allow unknown events', () => {
    const machine = createMachine<{}, { type: 'FOO'; value: number }>({});

    getShortestPlans(machine, {
      eventCases: {
        // @ts-expect-error
        UNKNOWN: [
          {
            value: 100
          }
        ]
      }
    });
  });

  it('`eventCases` should only allow props of a specific event', () => {
    const machine = createMachine<
      {},
      { type: 'FOO'; value: number } | { type: 'BAR'; other: string }
    >({});

    getShortestPlans(machine, {
      eventCases: {
        FOO: [
          {
            // @ts-expect-error
            other: 'nana nana nananana'
          }
        ]
      }
    });
  });

  it('`serializeEvent` should be allowed to return plain string', () => {
    const machine = createMachine({});

    getShortestPlans(machine, {
      serializeEvent: () => ''
    });
  });

  it('`serializeState` should be allowed to return plain string', () => {
    const machine = createMachine({});

    getShortestPlans(machine, {
      serializeState: () => ''
    });
  });
});
