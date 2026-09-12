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

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
