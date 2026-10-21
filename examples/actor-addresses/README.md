# actor-addresses

## What it teaches

Address-first actor identity: every actor has a deterministic logical address that is stable across persistence and restore, so actors can be addressed and routed to without holding a live reference.

## XState features used

- `actor.address` and generated child ids (`worker:0`, `worker:1`)
- `sessionId` as an incarnation id, changing on every restore
- `enq.spawn` with and without an explicit `id`, `enq.sendTo`
- `getPersistedSnapshot({ embedChildren: false })` and the location-transparent handles it restores
- `system.runtime.sendEvent` with the `deliverEvent` helper

## Run it

```bash
pnpm install
pnpm start
```

The demo prints four things:

1. Addresses are the `/`-joined path of actor ids from the root (`order/worker:0`), and generated ids are per-source counters that are identical on every run.
2. Sends address a child by name; `JSON.stringify` on a reference produces its identity (`id`, `address`, `src`) rather than its state.
3. After restore, addresses are unchanged while `sessionId` differs — a restored actor is a new incarnation of the same address — and id numbering continues where it left off.
4. Persisting with `embedChildren: false` stores children as `{ address, remote: true, src }`. Restoring that snapshot yields handles with no `sessionId`; a `sendEvent` runtime routes their events by address, and co-located-only operations such as `getPersistedSnapshot` throw with an explanation.

Part 4 keeps the owning actor in the same process, so the "remote" runtime is a function call rather than a wire. That is the only shortcut: the addresses, the persisted shape and the routing path are the real ones. For a durable host that implements the same runtime operations against a journal, see [`examples/durable-execution`](../durable-execution).

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
