import { createInterface } from 'node:readline';
import { createClient } from 'redis';
import { createActor } from 'xstate';
import { isOrderEvent, ORDER_EVENTS, orderMachine } from './orderMachine';
import { TaskQueue } from './TaskQueue';

const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
const actorId = process.env.ACTOR_ID ?? 'order-1';
const key = `xstate:snapshot:${actorId}`;

/**
 * Snapshots expire after this many seconds. Redis is a good fit for workflows
 * that are allowed to be abandoned; drop the TTL for ones that are not.
 */
const TTL_SECONDS = 60 * 60 * 24;

const client = createClient({ url });

client.on('error', (error) => console.error('redis error:', error));

await client.connect();

const stored = await client.get(key);

console.log(
  stored
    ? `Resuming ${actorId} from Redis.`
    : `No persisted state at ${key}. Starting from scratch.`
);

const actor = createActor(orderMachine, {
  snapshot: stored ? JSON.parse(stored) : undefined
});

// Writes are queued so that snapshots reach Redis in transition order.
const taskQueue = new TaskQueue();
const bold = (value: string) => `\x1b[1m${value}\x1b[0m`;

actor.subscribe({
  next(state) {
    const nextEvents = ORDER_EVENTS.filter((type) => state.can({ type }));

    taskQueue.addTask(async () => {
      await client.set(key, JSON.stringify(actor.getPersistedSnapshot()), {
        EX: TTL_SECONDS
      });

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
      // The workflow is over, so the snapshot is deleted rather than left to
      // expire.
      await client.del(key);
      await client.quit();
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

await client.quit();
