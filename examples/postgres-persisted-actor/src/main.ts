import { createInterface } from 'node:readline';
import pg from 'pg';
import { createActor } from 'xstate';
import { isOrderEvent, ORDER_EVENTS, orderMachine } from './orderMachine';
import { TaskQueue } from './TaskQueue';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const connectionString =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/postgres';
const actorId = process.env.ACTOR_ID ?? 'order-1';

const pool = new pg.Pool({ connectionString });

// One row per actor, holding its latest snapshot as JSONB.
await pool.query(`
  create table if not exists xstate_snapshots (
    id text primary key,
    snapshot jsonb not null,
    updated_at timestamptz not null default now()
  )
`);

// `snapshot::text` keeps the driver from handing back a widened `unknown`.
const stored = await pool.query<{ snapshot: string }>(
  'select snapshot::text as snapshot from xstate_snapshots where id = $1',
  [actorId]
);

const snapshot = stored.rows[0]
  ? JSON.parse(stored.rows[0].snapshot)
  : undefined;

console.log(
  snapshot
    ? `Resuming ${actorId} from Postgres.`
    : `No persisted state for ${actorId}. Starting from scratch.`
);

const actor = createActor(orderMachine, {
  snapshot,
  inspect: inspector?.inspect
});

// Writes are queued so that snapshots reach the database in transition order.
const taskQueue = new TaskQueue();
const bold = (value: string) => `\x1b[1m${value}\x1b[0m`;

actor.subscribe({
  next(state) {
    const nextEvents = ORDER_EVENTS.filter((type) => state.can({ type }));

    taskQueue.addTask(async () => {
      await pool.query(
        `insert into xstate_snapshots (id, snapshot, updated_at)
         values ($1, $2, now())
         on conflict (id) do update
           set snapshot = excluded.snapshot, updated_at = now()`,
        [actorId, JSON.stringify(actor.getPersistedSnapshot())]
      );

      console.log(
        'Current state:',
        `${bold(JSON.stringify(state.value))}\n`,
        'Next events:',
        nextEvents.map((type) => `\n  ${bold(type)}`).join(''),
        '\nEnter the next event to send:'
      );
    });
  },
  complete() {
    taskQueue.addTask(async () => {
      console.log('Workflow completed', actor.getSnapshot().output);
      await pool.end();
      process.exit(0);
    });
  }
});

actor.start();

const input = createInterface({ input: process.stdin });

for await (const line of input) {
  const type = line.trim();

  if (!isOrderEvent(type)) {
    console.log(`Unknown event: ${type}`);
    continue;
  }

  actor.send({ type });
}

await pool.end();

inspector?.destroy();
