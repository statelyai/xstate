# websocket-server

## What it teaches

Modelling a WebSocket server as actors: one spawned session actor per connection, with a handshake, a heartbeat timeout that drops silent clients, and broadcast routing between sessions.

## XState features used

- `setup()` with `schemas` and named `delays`
- `enq.spawn` for one session actor per connection, `enq.sendTo` for routing
- delayed transitions (`after`) plus `reenter: true` to re-arm the heartbeat
- machine-level `on` handlers, final state `entry`

## Run it

```bash
pnpm install
pnpm start
```

The demo starts a real `ws` server on an ephemeral port and connects two in-process clients. They exchange broadcasts, then `bob` stops sending and the heartbeat timeout closes his socket. No network access is needed.

The `start` script passes `--conditions=module` so that Node resolves `xstate` to this repo's source.

`ws` is the dependency that makes this a real server rather than a simulation; sockets are kept in a `Map` outside the machines so that only serialisable data lives in context.

## Inspect it

Inspector: pending v6-compatible `@statelyai/inspect`. Until then the example logs every session transition to stdout.
