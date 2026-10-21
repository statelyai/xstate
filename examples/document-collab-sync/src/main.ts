import { createActor, setup, types } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** An operation is an append, which keeps the rebase rule to one line. */
interface Op {
  text: string;
}

const LATENCY = 60;

/**
 * The server owns the canonical document. A submission is accepted only if the
 * client based it on the current version; otherwise the client is told the
 * canonical state and has to rebase.
 */
const serverMachine = setup({
  schemas: {
    context: types<{ text: string; version: number; accepted: number }>(),
    events: {
      submit: types<{ clientId: string; baseVersion: number; op: Op }>()
    }
  }
}).createMachine({
  context: { text: '', version: 0, accepted: 0 },
  on: {
    submit: ({ context, event }, enq) => {
      if (event.baseVersion !== context.version) {
        enq(
          log,
          `server: rejected ${event.clientId} (based on v${event.baseVersion}, canonical is v${context.version})`
        );
        enq(toClient, event.clientId, {
          type: 'rejected',
          version: context.version,
          text: context.text
        });
        return;
      }

      const text = context.text + event.op.text;
      const version = context.version + 1;

      enq(log, `server: accepted ${event.clientId} -> v${version} "${text}"`);
      enq(toClient, event.clientId, { type: 'accepted', version, text });

      return { context: { text, version, accepted: context.accepted + 1 } };
    }
  }
});

const MAX_REBASES = 2;

/**
 * A client edits locally, submits, and either lands or resyncs onto the
 * canonical document and retries the same op.
 */
const clientMachine = setup({
  schemas: {
    context: types<{
      id: string;
      text: string;
      version: number;
      pending: Op | null;
      rebases: number;
    }>(),
    events: {
      edit: types<{ text: string }>(),
      accepted: types<{ version: number; text: string }>(),
      rejected: types<{ version: number; text: string }>()
    },
    input: types<{ id: string }>()
  }
}).createMachine({
  context: ({ input }) => ({
    id: input.id,
    text: '',
    version: 0,
    pending: null,
    rebases: 0
  }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        edit: ({ context, event }, enq) => {
          const op = { text: event.text };
          enq(
            log,
            `${context.id}: editing "${event.text}" on v${context.version}`
          );
          enq(toServer, context.id, context.version, op);
          return { target: 'submitted', context: { pending: op } };
        }
      }
    },
    submitted: {
      on: {
        accepted: ({ context, event }, enq) => {
          enq(log, `${context.id}: landed on v${event.version}`);
          return {
            target: 'idle',
            context: {
              text: event.text,
              version: event.version,
              pending: null
            }
          };
        },
        // Out of date: adopt the canonical document, then replay the same op
        // on top of it.
        rejected: ({ context, event }, enq) => {
          if (context.rebases >= MAX_REBASES) {
            enq(
              log,
              `${context.id}: giving up after ${context.rebases} rebases`
            );
            return { target: 'conflicted' };
          }

          enq(
            log,
            `${context.id}: resyncing to v${event.version} and rebasing "${context.pending!.text}"`
          );
          enq(toServer, context.id, event.version, context.pending!);

          return {
            target: 'submitted',
            reenter: true,
            context: {
              text: event.text,
              version: event.version,
              rebases: context.rebases + 1
            }
          };
        }
      }
    },
    conflicted: {
      type: 'final',
      output: ({ context }) => ({ id: context.id, dropped: context.pending })
    }
  }
});

/** The "network": in-process, with a little latency in both directions. */
const clients = new Map<string, ReturnType<typeof startClient>>();
const server = createActor(serverMachine, { inspect: inspector?.inspect });

function toServer(clientId: string, baseVersion: number, op: Op) {
  setTimeout(
    () => server.send({ type: 'submit', clientId, baseVersion, op }),
    LATENCY
  );
}

function toClient(
  clientId: string,
  message:
    | { type: 'accepted'; version: number; text: string }
    | { type: 'rejected'; version: number; text: string }
) {
  setTimeout(() => clients.get(clientId)?.send(message), LATENCY);
}

function startClient(id: string) {
  const actor = createActor(clientMachine, {
    input: { id },
    inspect: inspector?.inspect
  });
  actor.start();
  return actor;
}

server.start();

for (const id of ['client-a', 'client-b']) {
  clients.set(id, startClient(id));
}

// Both clients edit from v0. One wins; the other is rejected and rebases.
clients.get('client-a')!.send({ type: 'edit', text: 'Hello ' });
clients.get('client-b')!.send({ type: 'edit', text: 'World' });

await wait(600);

const doc = server.getSnapshot().context;
log(`document: v${doc.version} "${doc.text}" (${doc.accepted} ops accepted)`);

for (const [id, actor] of clients) {
  const { version, rebases } = actor.getSnapshot().context;
  log(`${id}: at v${version} after ${rebases} rebase(s)`);
  actor.stop();
}

server.stop();

inspector?.destroy();
