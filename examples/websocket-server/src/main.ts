import { createActor, setup, types } from 'xstate';
import { WebSocket, WebSocketServer } from 'ws';

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The transport. Sockets live outside the machines, keyed by session id. */
const sockets = new Map<string, WebSocket>();

const sendToClient = (sessionId: string, payload: unknown) => {
  const socket = sockets.get(sessionId);
  socket?.send(JSON.stringify(payload));
};

const dropConnection = (sessionId: string, reason: string) => {
  log(`server: dropping ${sessionId} (${reason})`);
  sockets.get(sessionId)?.close(4000, reason);
};

/**
 * One session actor per connection. It owns the lifecycle of a single client:
 * handshake, then an active phase that must be kept alive by traffic, then
 * teardown.
 */
const sessionMachine = setup({
  schemas: {
    context: types<{ sessionId: string; user: string; received: number }>(),
    events: {
      hello: types<{ user: string }>(),
      clientMessage: types<{ text: string }>(),
      broadcast: types<{ from: string; text: string }>(),
      disconnect: types<{}>()
    },
    input: types<{ sessionId: string }>()
  },
  delays: { heartbeatTimeout: 900 }
}).createMachine({
  context: ({ input }) => ({
    sessionId: input.sessionId,
    user: 'anonymous',
    received: 0
  }),
  initial: 'handshake',
  on: { disconnect: { target: '.closed' } },
  states: {
    handshake: {
      after: { heartbeatTimeout: { target: 'closing' } },
      on: {
        hello: ({ context, event }, enq) => {
          enq(log, `session ${context.sessionId}: hello from ${event.user}`);
          enq(sendToClient, context.sessionId, {
            type: 'welcome',
            sessionId: context.sessionId
          });
          return { target: 'active', context: { user: event.user } };
        }
      }
    },
    // Any inbound traffic re-enters `active`, which cancels and re-arms the
    // delayed transition. `reenter: true` is what makes the timer restart.
    active: {
      after: { heartbeatTimeout: { target: 'closing' } },
      on: {
        clientMessage: ({ context, event }, enq) => {
          enq(
            log,
            `session ${context.sessionId}: <- ${event.text} (from ${context.user})`
          );
          return {
            target: 'active',
            reenter: true,
            context: { received: context.received + 1 }
          };
        },
        broadcast: ({ context, event }, enq) => {
          if (event.from === context.user) return;
          enq(sendToClient, context.sessionId, {
            type: 'broadcast',
            from: event.from,
            text: event.text
          });
        }
      }
    },
    closing: {
      entry: ({ context }, enq) => {
        enq(dropConnection, context.sessionId, 'heartbeat timeout');
      },
      on: { disconnect: { target: 'closed' } }
    },
    closed: {
      type: 'final',
      entry: ({ context }, enq) =>
        enq(
          log,
          `session ${context.sessionId}: closed after ${context.received} message(s)`
        )
    }
  }
});

interface SessionRef {
  send: (
    event:
      | { type: 'hello'; user: string }
      | { type: 'clientMessage'; text: string }
      | { type: 'broadcast'; from: string; text: string }
      | { type: 'disconnect' }
  ) => void;
}

/** The server actor routes socket traffic to the right session actor. */
const serverMachine = setup({
  schemas: {
    context: types<{ sessions: Record<string, SessionRef> }>(),
    events: {
      connect: types<{ sessionId: string }>(),
      incoming: types<{ sessionId: string; message: any }>(),
      close: types<{ sessionId: string }>()
    }
  }
}).createMachine({
  context: { sessions: {} },
  on: {
    connect: ({ context, event }, enq) => {
      enq(log, `server: ${event.sessionId} connected`);
      const session = enq.spawn(sessionMachine, {
        id: event.sessionId,
        input: { sessionId: event.sessionId }
      });
      return {
        context: {
          sessions: { ...context.sessions, [event.sessionId]: session }
        }
      };
    },
    incoming: ({ context, event }, enq) => {
      const session = context.sessions[event.sessionId];
      if (!session) return;
      if (event.message.type === 'hello') {
        enq.sendTo(session, { type: 'hello', user: event.message.user });
        return;
      }
      enq.sendTo(session, {
        type: 'clientMessage',
        text: event.message.text
      });
      // Fan the message out to everyone else.
      for (const other of Object.values(context.sessions)) {
        if (other === session) continue;
        enq.sendTo(other, {
          type: 'broadcast',
          from: event.message.user,
          text: event.message.text
        });
      }
    },
    close: ({ context, event }, enq) => {
      const { [event.sessionId]: session, ...rest } = context.sessions;
      if (session) enq.sendTo(session, { type: 'disconnect' });
      return { context: { sessions: rest } };
    }
  }
});

const server = createActor(serverMachine);
server.start();

let nextId = 0;
const wss = new WebSocketServer({ port: 0 });

wss.on('connection', (socket) => {
  const sessionId = `s-${++nextId}`;
  sockets.set(sessionId, socket);
  server.send({ type: 'connect', sessionId });

  socket.on('message', (data) => {
    server.send({
      type: 'incoming',
      sessionId,
      message: JSON.parse(String(data))
    });
  });
  socket.on('close', () => {
    sockets.delete(sessionId);
    server.send({ type: 'close', sessionId });
  });
});

await new Promise<void>((resolve) => wss.on('listening', () => resolve()));
const { port } = wss.address() as { port: number };
log(`server: listening on ws://localhost:${port}`);

/** Two in-process clients so the demo runs offline. */
const connectClient = async (user: string) => {
  const socket = new WebSocket(`ws://localhost:${port}`);
  await new Promise<void>((resolve) => socket.on('open', () => resolve()));
  socket.on('message', (data) => log(`client ${user}: <- ${String(data)}`));
  socket.on('close', (code, reason) =>
    log(`client ${user}: socket closed (${code} ${reason})`)
  );
  socket.send(JSON.stringify({ type: 'hello', user }));
  return socket;
};

const alice = await connectClient('alice');
const bob = await connectClient('bob');

await wait(200);
alice.send(JSON.stringify({ type: 'msg', user: 'alice', text: 'hi bob' }));
await wait(200);
bob.send(JSON.stringify({ type: 'msg', user: 'bob', text: 'hi alice' }));

// alice keeps talking; bob goes silent and gets dropped by the heartbeat.
for (let i = 0; i < 4; i++) {
  await wait(400);
  alice.send(JSON.stringify({ type: 'msg', user: 'alice', text: `beat ${i}` }));
}

await wait(600);
log('demo: done, shutting down');
alice.close();
await wait(100);
wss.close();
server.stop();
