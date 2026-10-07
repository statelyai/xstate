import { z } from 'zod';
import { createActor, createMachine, machineVersions, types } from '../src';
import type { StandardSchemaV1 } from '../src';

describe('public eventSchema', () => {
  const machine = createMachine({
    id: 'public',
    version: '1',
    schemas: {
      events: { ADD: z.object({ value: z.string().transform(Number) }) },
      internalEvents: { 'private.*': z.object({ value: z.number() }) }
    },
    initial: 'idle',
    states: {
      idle: {},
      routed: { id: 'routed', route: {} },
      hidden: { id: 'hidden' }
    }
  });

  it('validates and transforms public payloads', async () => {
    await expect(
      machine.eventSchema['~standard'].validate({ type: 'ADD', value: '2' })
    ).resolves.toEqual({ value: { type: 'ADD', value: 2 } });
    for (const value of [
      null,
      [],
      {},
      { type: 1 },
      { type: 'UNKNOWN' },
      { type: 'ADD', value: false }
    ]) {
      await expect(
        machine.eventSchema['~standard'].validate(value)
      ).resolves.toHaveProperty('issues');
    }
  });

  it('rejects internal descriptors and all reserved runtime namespaces', async () => {
    for (const type of [
      'private.tick',
      'xstate.done.actor.child',
      'xstate.error.actor.child',
      'xstate.after.timer',
      'xstate.init',
      '@xstate.start',
      'xstate.future'
    ]) {
      await expect(
        machine.eventSchema['~standard'].validate({ type, value: 1 })
      ).resolves.toHaveProperty('issues');
    }
  });

  it('accepts only explicitly configured route destinations', async () => {
    await expect(
      machine.eventSchema['~standard'].validate({
        type: 'xstate.route',
        to: '#routed'
      })
    ).resolves.toEqual({ value: { type: 'xstate.route', to: '#routed' } });
    for (const to of ['#hidden', '#missing', 'routed', undefined, 1]) {
      await expect(
        machine.eventSchema['~standard'].validate({ type: 'xstate.route', to })
      ).resolves.toHaveProperty('issues');
    }
    const actor = createActor(machine).start();
    actor.send({ type: 'xstate.route', to: '#routed' });
    expect(actor.getSnapshot().value).toBe('routed');
  });

  it('validates configured route payload schemas before accepting a destination', async () => {
    const route = createMachine({
      schemas: {
        events: {
          'xstate.route': z.object({ to: z.string(), token: z.string() })
        }
      },
      initial: 'idle',
      states: { idle: {}, routed: { id: 'routed', route: {} } }
    });
    await expect(
      route.eventSchema['~standard'].validate({
        type: 'xstate.route',
        to: '#routed'
      })
    ).resolves.toHaveProperty('issues');
    await expect(
      route.eventSchema['~standard'].validate({
        type: 'xstate.route',
        to: '#routed',
        token: 'ok'
      })
    ).resolves.toEqual({
      value: { type: 'xstate.route', to: '#routed', token: 'ok' }
    });
  });

  it('keeps unspecified application events open without schemas', async () => {
    const open = createMachine({});
    await expect(
      open.eventSchema['~standard'].validate({ type: 'anything' })
    ).resolves.toEqual({ value: { type: 'anything' } });
    await expect(
      open.eventSchema['~standard'].validate({ type: 'xstate.init' })
    ).resolves.toHaveProperty('issues');
  });

  it('internal declarations override overlapping public wildcards', async () => {
    const wildcard = createMachine({
      schemas: {
        events: { '*': z.object({}) },
        internalEvents: { 'private.*': z.object({}) }
      }
    });
    await expect(
      wildcard.eventSchema['~standard'].validate({ type: 'private.tick' })
    ).resolves.toHaveProperty('issues');
    await expect(
      wildcard.eventSchema['~standard'].validate({ type: 'public.tick' })
    ).resolves.toEqual({ value: { type: 'public.tick' } });
  });

  it('preserves internal/runtime history validation for same-version and adapted histories', async () => {
    const target = createMachine({
      id: 'public',
      version: '2',
      schemas: {
        internalEvents: { 'private.*': z.object({ value: z.number() }) }
      }
    });
    const versions = machineVersions([machine, target]);
    const history = [
      { type: 'private.tick', value: 2 },
      { type: 'xstate.done.actor.child', output: 3 }
    ];
    await expect(
      versions.adaptEvents(history, {
        from: { id: 'public', version: '1' },
        to: '1',
        adapters: {}
      })
    ).resolves.toEqual(history);
    await expect(
      versions.adaptEvents(history, {
        from: { id: 'public', version: '1' },
        to: '2',
        adapters: { '1': (events) => events }
      })
    ).resolves.toEqual(history);
    await expect(
      versions.adaptEvents([{ type: 'private.tick', value: 'bad' }], {
        from: { id: 'public', version: '1' },
        to: '1',
        adapters: {}
      })
    ).rejects.toThrow();
  });
});

const typed = createMachine({
  schemas: {
    events: { ADD: types<{ value: number }>() },
    internalEvents: { PRIVATE: types<{ secret: string }>() }
  }
});
type PublicEvent = StandardSchemaV1.InferOutput<typeof typed.eventSchema>;
const publicEvent: PublicEvent = { type: 'ADD', value: 1 };
// @ts-expect-error Internal events are not public schema output.
const internalEvent: PublicEvent = { type: 'PRIVATE', secret: 'hidden' };
void [publicEvent, internalEvent];

// History adapters retain internal-event inference even though public input excludes it.
const typedHistory = createMachine({
  id: 'typed',
  version: '1',
  schemas: {
    events: { ADD: types<{ value: number }>() },
    internalEvents: { PRIVATE: types<{ secret: string }>() }
  }
});
const typedTarget = createMachine({ ...typedHistory.config, version: '2' });
void machineVersions([typedHistory, typedTarget]).adaptEvents([], {
  from: { id: 'typed', version: '1' },
  to: '2',
  adapters: {
    '1': (events) => {
      for (const event of events) {
        if (event.type === 'PRIVATE') {
          const secret: string = event.secret;
          void secret;
        }
      }
      return events;
    }
  }
});

const runtimeTyped = createMachine({
  schemas: {
    events: {
      PUBLIC: types<{}>(),
      'xstate.done.actor.child': types<{ output: number }>()
    }
  }
});
type RuntimePublicEvent = StandardSchemaV1.InferOutput<
  typeof runtimeTyped.eventSchema
>;
const runtimePublicEvent: RuntimePublicEvent = {
  // @ts-expect-error Runtime notifications are excluded even if a schema declares them.
  type: 'xstate.done.actor.child',
  output: 1
};
void runtimePublicEvent;
