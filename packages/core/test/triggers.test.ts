import { createActor, createMachine } from '../src';

describe('triggers', () => {
  it('exposes declared triggers on the machine', () => {
    const machine = createMachine({
      triggers: [
        { type: 'webhook', path: '/api/orders' },
        { type: 'cron', schedule: '0 9 * * *' }
      ],
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    expect(machine.triggers).toEqual([
      { type: 'webhook', path: '/api/orders' },
      { type: 'cron', schedule: '0 9 * * *' }
    ]);
  });

  it('defaults to an empty triggers array when none are declared', () => {
    const machine = createMachine({
      initial: 'idle',
      states: { idle: {} }
    });

    expect(machine.triggers).toEqual([]);
  });

  it('allows arbitrary platform-specific properties on triggers', () => {
    const machine = createMachine({
      triggers: [
        {
          type: 'event',
          source: 'order.created',
          filter: { region: 'us-east' },
          description: 'Fires when a new order arrives'
        }
      ],
      initial: 'idle',
      states: { idle: {} }
    });

    expect(machine.triggers[0]).toMatchObject({
      type: 'event',
      source: 'order.created',
      filter: { region: 'us-east' },
      description: 'Fires when a new order arrives'
    });
  });
});
