import { createActor, setup, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) => console.log(message);

interface Request {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, any>;
}

interface Response {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

const TOOLS = {
  add: (args: { a: number; b: number }) => args.a + args.b,
  upper: (args: { text: string }) => args.text.toUpperCase()
} as const;

/** Stands in for the tool implementation reached over the transport. */
const callTool = createAsyncLogic({
  run: async ({ input }: { input: { name: string; args: any } }) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const tool = TOOLS[input.name as keyof typeof TOOLS];
    if (!tool) {
      throw new Error(`Unknown tool: ${input.name}`);
    }
    return tool(input.args);
  }
});

/** One actor per client session. Its lifecycle is the MCP handshake. */
const sessionMachine = setup({
  schemas: {
    context: types<{
      sessionId: string;
      clientName: string;
      pending: Request | null;
      handled: number;
    }>(),
    events: { request: types<{ request: Request }>() },
    input: types<{ sessionId: string }>(),
    output: types<{ sessionId: string; handled: number }>()
  },
  actors: { callTool }
}).createMachine({
  context: ({ input }) => ({
    sessionId: input.sessionId,
    clientName: '',
    pending: null,
    handled: 0
  }),
  initial: 'uninitialized',
  states: {
    // Only `initialize` is accepted before the handshake completes.
    uninitialized: {
      on: {
        request: ({ context, event }, enq) => {
          if (event.request.method !== 'initialize') {
            enq(send, context.sessionId, {
              jsonrpc: '2.0',
              id: event.request.id,
              error: { code: -32002, message: 'Server not initialized' }
            });
            return undefined;
          }
          const clientName =
            event.request.params?.clientInfo?.name ?? 'unknown';
          enq(send, context.sessionId, {
            jsonrpc: '2.0',
            id: event.request.id,
            result: {
              protocolVersion: '2025-06-18',
              serverInfo: { name: 'xstate-demo-server', version: '0.0.0' },
              capabilities: { tools: {} }
            }
          });
          return { target: 'ready', context: { clientName } };
        }
      }
    },
    ready: {
      on: {
        request: ({ context, event }, enq) => {
          const { method, id } = event.request;
          if (method === 'tools/list') {
            enq(send, context.sessionId, {
              jsonrpc: '2.0',
              id,
              result: { tools: Object.keys(TOOLS).map((name) => ({ name })) }
            });
            return { context: { handled: context.handled + 1 } };
          }
          if (method === 'tools/call') {
            return {
              target: 'handlingTool',
              context: { pending: event.request }
            };
          }
          if (method === 'shutdown') {
            enq(send, context.sessionId, { jsonrpc: '2.0', id, result: {} });
            return { target: 'shutdown' };
          }
          enq(send, context.sessionId, {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
          });
          return { context: { handled: context.handled + 1 } };
        }
      }
    },
    // The session blocks here while one tool call is in flight; concurrent
    // sessions are separate actors, so they never wait on each other.
    handlingTool: {
      invoke: {
        src: 'callTool',
        input: ({ context }) => ({
          name: context.pending!.params?.name,
          args: context.pending!.params?.arguments
        }),
        onDone: ({ context, event }, enq) => {
          enq(send, context.sessionId, {
            jsonrpc: '2.0',
            id: context.pending!.id,
            result: { content: [{ type: 'text', text: String(event.output) }] }
          });
          return {
            target: 'ready',
            context: { pending: null, handled: context.handled + 1 }
          };
        },
        onError: ({ context, event }, enq) => {
          enq(send, context.sessionId, {
            jsonrpc: '2.0',
            id: context.pending!.id,
            error: { code: -32602, message: (event.error as Error).message }
          });
          return {
            target: 'ready',
            context: { pending: null, handled: context.handled + 1 }
          };
        }
      }
    },
    shutdown: {
      type: 'final',
      output: ({ context }) => ({
        sessionId: context.sessionId,
        handled: context.handled
      })
    }
  }
});

/** The "transport": in-process instead of newline-delimited JSON on stdio. */
function send(sessionId: string, response: Response) {
  log(`← [${sessionId}] ${JSON.stringify(response)}`);
}

/** The server only needs to talk to a session. */
interface SessionRef {
  send: (event: { type: 'request'; request: Request }) => void;
}

const serverMachine = setup({
  schemas: {
    context: types<{ sessions: Record<string, SessionRef> }>(),
    events: {
      connect: types<{ sessionId: string }>(),
      incoming: types<{ sessionId: string; request: Request }>(),
      sessionDone: types<{ output: { sessionId: string; handled: number } }>()
    }
  }
}).createMachine({
  context: { sessions: {} },
  // The server itself has no lifecycle: it only routes messages to sessions.
  on: {
    // Each connection spawns a session actor keyed by its id.
    connect: ({ context, event }, enq) => {
      enq(log, `session ${event.sessionId} connected`);
      const session = enq.spawn(sessionMachine, {
        id: event.sessionId,
        input: { sessionId: event.sessionId }
      });
      enq.subscribeTo(session, {
        done: (output) => ({ type: 'sessionDone', output })
      });
      return {
        context: {
          sessions: { ...context.sessions, [event.sessionId]: session }
        }
      };
    },
    // Each session reports its result when it reaches shutdown.
    sessionDone: ({ context, event }, enq) => {
      const { sessionId, handled } = event.output;
      enq(log, `session ${sessionId}: done, ${handled} request(s) handled`);
      const { [sessionId]: _, ...sessions } = context.sessions;
      return { context: { sessions } };
    },
    incoming: ({ context, event }, enq) => {
      enq(log, `→ [${event.sessionId}] ${JSON.stringify(event.request)}`);
      enq.sendTo(context.sessions[event.sessionId], {
        type: 'request',
        request: event.request
      });
    }
  }
});

const server = createActor(serverMachine, { inspect: inspector?.inspect });
server.start();

let nextId = 0;
const rpc = (method: string, params?: Record<string, any>): Request => ({
  jsonrpc: '2.0',
  id: ++nextId,
  method,
  params
});

for (const sessionId of ['s-a', 's-b']) {
  server.send({ type: 'connect', sessionId });
}

// Two sessions interleaved on one server.
const script: Array<[string, Request]> = [
  ['s-a', rpc('tools/call', { name: 'add', arguments: { a: 1, b: 2 } })],
  ['s-a', rpc('initialize', { clientInfo: { name: 'editor' } })],
  ['s-b', rpc('initialize', { clientInfo: { name: 'cli' } })],
  ['s-a', rpc('tools/list')],
  ['s-b', rpc('tools/call', { name: 'upper', arguments: { text: 'hello' } })],
  ['s-a', rpc('tools/call', { name: 'add', arguments: { a: 20, b: 22 } })],
  ['s-b', rpc('tools/call', { name: 'missing', arguments: {} })],
  ['s-a', rpc('shutdown')],
  ['s-b', rpc('shutdown')]
];

for (const [sessionId, request] of script) {
  server.send({ type: 'incoming', sessionId, request });
  await new Promise((resolve) => setTimeout(resolve, 80));
}

await new Promise((resolve) => setTimeout(resolve, 200));

server.stop();

inspector?.destroy();
