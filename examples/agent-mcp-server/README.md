# agent-mcp-server

## What it teaches

How to model an MCP-shaped server where every client session is its own spawned actor: initialize, ready, handling a tool call, shutdown — with concurrent sessions isolated from each other.

## XState features used

- `enq.spawn` for one session actor per connection
- `enq.sendTo` for routing incoming requests to the right session
- `invoke` with `createAsyncLogic` for the in-flight tool call
- `onError` mapped to a JSON-RPC error response
- final state `output`

## Run it

```bash
pnpm install
pnpm start
```

The transport is simulated in-process — plain JSON-RPC objects, no stdio and no MCP SDK dependency. The demo drives two concurrent sessions, including a request sent before the handshake and a call to an unknown tool.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every request and response, prefixed with the session id, to stdout.
