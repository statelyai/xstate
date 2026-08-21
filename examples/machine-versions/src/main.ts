import { createActor, createMachine, machineVersions } from 'xstate';
import { createInspector } from '@statelyai/sdk';
import { z } from 'zod';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) => console.log(message);

/**
 * Version 1 is no longer executable code — only a description of what it
 * persisted. A `MachineVersionDescriptor` is `{ id, version }` plus a
 * snapshot schema, an event schema, or both.
 */
const checkoutV1 = {
  id: 'checkout',
  version: '1',
  snapshotSchema: z
    .object({
      status: z.literal('active'),
      value: z.literal('cart'),
      // v1 counted items and stored a whole-dollar total.
      context: z.object({ items: z.number(), dollars: z.number() }),
      children: z.record(z.string(), z.unknown()),
      historyValue: z.record(z.string(), z.unknown()),
      timers: z.record(z.string(), z.unknown()),
      machine: z.object({
        id: z.literal('checkout'),
        version: z.literal('1')
      }),
      version: z.literal('1')
    })
    .passthrough(),
  eventSchema: z.discriminatedUnion('type', [
    z.object({ type: z.literal('add'), dollars: z.number() }),
    z.object({ type: z.literal('remove'), dollars: z.number() })
  ])
} as const;

/** Version 2 is the machine that runs today. It stores cents, not dollars. */
const checkoutV2 = createMachine({
  id: 'checkout',
  version: '2',
  // `createMachine` rather than `setup()`: a version declared through
  // `setup().createMachine()` widens to `string`, which loses the literal
  // that `machineVersions` matches migrations and adapters against.
  schemas: {
    context: z.object({ items: z.number(), cents: z.number() }),
    events: {
      addItem: z.object({ cents: z.number() }),
      checkout: z.object({})
    }
  },
  context: { items: 0, cents: 0 },
  initial: 'cart',
  states: {
    cart: {
      on: {
        addItem: ({ context, event }) => ({
          context: {
            items: context.items + 1,
            cents: context.cents + event.cents
          }
        }),
        checkout: { target: 'paying' }
      }
    },
    paying: {}
  }
});

// Every entry shares the machine id; each declares its own version.
const checkoutVersions = machineVersions([checkoutV1, checkoutV2]);

// What storage handed back: a v1 snapshot, written before v2 existed.
const storedSnapshot = {
  status: 'active',
  value: 'cart',
  context: { items: 2, dollars: 34 },
  children: {},
  historyValue: {},
  timers: {},
  _nextActorIds: {},
  _nextTimerId: 0,
  machine: { id: 'checkout', version: '1' },
  version: '1'
};

log('1. migrate a v1 snapshot to the machine that runs today');
const migrated = await checkoutVersions.migrateSnapshot(storedSnapshot, {
  to: '2',
  migrations: {
    // The exact version key narrows `snapshot` to v1's schema output, so
    // `context.dollars` is typed and `context.cents` would not compile.
    '1': (snapshot) => ({
      ...snapshot,
      // v1 never persisted `output`/`error`; the target's snapshot contract
      // requires both keys to be present.
      output: undefined,
      error: undefined,
      context: {
        items: snapshot.context.items,
        cents: snapshot.context.dollars * 100
      }
    })
  }
});
log(`   migrated context: ${JSON.stringify(migrated.context)}`);
log(`   stamped identity: ${JSON.stringify(migrated.machine)}`);

const actor = createActor(checkoutV2, {
  snapshot: migrated,
  inspect: inspector?.inspect
}).start();
actor.send({ type: 'addItem', cents: 599 });
log(`   restored and running: ${JSON.stringify(actor.getSnapshot().context)}`);
actor.stop();

log('\n2. the descriptor validates the historical data before migrating');
try {
  await checkoutVersions.migrateSnapshot(
    { ...storedSnapshot, context: { items: 2, dollars: 'thirty-four' } },
    { to: '2', migrations: { '1': (snapshot) => snapshot as never } }
  );
} catch (error) {
  log(`   rejected: ${(error as Error).message}`);
}

log('\n3. adapt a v1 event history to v2 events');
const history = [
  { type: 'add', dollars: 20 },
  { type: 'add', dollars: 14 },
  { type: 'remove', dollars: 20 }
];
const adapted = await checkoutVersions.adaptEvents(history, {
  from: { id: 'checkout', version: '1' },
  to: '2',
  adapters: {
    // Adapters receive and return whole arrays, so they may drop, combine
    // or reorder events. Source events are validated first.
    '1': (events) => [
      {
        type: 'addItem' as const,
        cents:
          events.reduce(
            (total, event) =>
              event.type === 'add'
                ? total + event.dollars
                : total - event.dollars,
            0
          ) * 100
      }
    ]
  }
});
log(`   ${history.length} v1 events -> ${JSON.stringify(adapted)}`);

log('\n4. a version with no retained machine cannot be a target');
try {
  // v1 describes historical data; only a real machine can interpret state.
  await checkoutVersions.migrateSnapshot(storedSnapshot, {
    to: '1' as never,
    migrations: {}
  });
} catch (error) {
  log(`   rejected: ${(error as Error).message}`);
}

inspector?.destroy();
