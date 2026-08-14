import express from 'express';
import { createActor, type Actor, type Snapshot } from 'xstate';
import { kycMachine } from './kycMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

/** In-memory persistence: every transition writes the applicant's snapshot. */
const snapshots = new Map<string, Snapshot<unknown>>();
const actors = new Map<string, Actor<typeof kycMachine>>();

const nextId = (() => {
  let n = 0;
  return () => `kyc-${++n}`;
})();

export const app = express();

app.use(express.json());

app.post('/applicants', (req, res) => {
  const id = nextId();
  const actor = createActor(kycMachine, {
    input: { applicant: { name: req.body.name, country: req.body.country } },
    inspect: inspector?.inspect
  });

  // The actor stays running because the automated checks are in flight; the
  // snapshot store is what an API consumer reads.
  actor.subscribe(() => snapshots.set(id, actor.getPersistedSnapshot()));
  actors.set(id, actor);
  actor.start();

  res.status(201).json({ id, state: actor.getSnapshot().value });
});

app.get('/applicants/:id', (req, res) => {
  const actor = actors.get(req.params.id);

  if (!actor) {
    res.status(404).json({ error: 'not found' });
    return;
  }

  const snapshot = actor.getSnapshot();

  res.json({
    id: req.params.id,
    state: snapshot.value,
    context: snapshot.context,
    output: snapshot.output ?? null,
    persisted: Boolean(snapshots.get(req.params.id))
  });
});

/** One endpoint per reviewer action; each is just an event on the machine. */
const review = (path: string, toEvent: (body: any) => any) =>
  app.post(`/applicants/:id/${path}`, (req, res) => {
    const actor = actors.get(req.params.id);

    if (!actor) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const before = actor.getSnapshot().value;
    actor.send(toEvent(req.body));
    const snapshot = actor.getSnapshot();

    if (JSON.stringify(before) === JSON.stringify(snapshot.value)) {
      res
        .status(409)
        .json({ error: `cannot ${path} while in ${JSON.stringify(before)}` });
      return;
    }

    res.json({ state: snapshot.value, output: snapshot.output ?? null });
  });

review('approve', (body) => ({
  type: 'approve',
  reviewer: body.reviewer ?? 'unknown'
}));
review('reject', (body) => ({
  type: 'reject',
  reviewer: body.reviewer ?? 'unknown',
  reason: body.reason ?? 'unspecified'
}));
review('request-info', (body) => ({
  type: 'requestInfo',
  reviewer: body.reviewer ?? 'unknown',
  question: body.question ?? 'please clarify'
}));
review('provide-info', (body) => ({
  type: 'provideInfo',
  answer: body.answer ?? ''
}));

export const startServer = (port = 4243) =>
  new Promise<{ port: number; close: () => void }>((resolve) => {
    const server = app.listen(port, () => {
      const address = server.address() as { port: number };
      resolve({
        port: address.port,
        close: () => {
          server.close();
          inspector?.destroy();
        }
      });
    });
  });

// `pnpm serve` runs this file directly.
if (process.argv[1]?.endsWith('server.ts')) {
  void startServer().then(({ port }) =>
    console.log(`KYC API listening on http://localhost:${port}`)
  );
}
