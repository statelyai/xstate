import { createInterface } from 'node:readline';
import { MongoClient } from 'mongodb';
import { createActor } from 'xstate';
import { donutMachine } from './donutMachine';
import { TaskQueue } from './TaskQueue';

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';

const client = new MongoClient(uri);
const donutCollection = client.db('donut-maker').collection('donuts');
const filter = { persistedState: { $exists: true } };

await client.connect();

const stored = await donutCollection.findOne(filter);

if (!stored) {
  console.log('No persisted state found in the db. Starting from scratch.');
}

const actor = createActor(donutMachine, { snapshot: stored?.persistedState });

// Writes are queued so that snapshots reach the database in transition order.
const taskQueue = new TaskQueue();
const bold = (value: string) => `\x1b[1m${value}\x1b[0m`;

actor.subscribe({
  next(snapshot) {
    const nextEvents = donutMachine.events.filter(
      (type) => !type.startsWith('done.') && snapshot.can({ type })
    );

    taskQueue.addTask(async () => {
      await donutCollection.updateOne(
        filter,
        { $set: { persistedState: actor.getPersistedSnapshot() } },
        { upsert: true }
      );

      console.log(
        'Current state:',
        `${bold(JSON.stringify(snapshot.value))}\n`,
        'Next events:',
        nextEvents.map((type) => `\n  ${bold(type)}`).join(''),
        '\nEnter the next event to send:'
      );
    });
  },
  complete() {
    taskQueue.addTask(async () => {
      console.log('Workflow completed', actor.getSnapshot().output);
      await client.close();
    });
  }
});

actor.start();

const input = createInterface({ input: process.stdin });

for await (const line of input) {
  actor.send({ type: line.trim() });
}
