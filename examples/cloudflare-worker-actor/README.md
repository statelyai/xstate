# cloudflare-worker-actor

## What it teaches

How to host one persisted actor per entity on Cloudflare Workers: a Durable Object rehydrates an order actor from its own storage on every request, applies the posted event, and writes the snapshot back.

## XState features used

- `getPersistedSnapshot()` and `createActor(machine, { snapshot })`
- `snapshot.can()` to reject events the order cannot accept
- transition functions that update context from event payloads
- final states

## Run it

```bash
pnpm install
pnpm dev # wrangler dev, http://localhost:8787
```

Then drive one order:

```bash
curl localhost:8787/orders/order-1
curl -X POST localhost:8787/orders/order-1 -d '{"type":"pay","amount":4200}'
curl -X POST localhost:8787/orders/order-1 -d '{"type":"ship","carrier":"dhl"}'
curl -X POST localhost:8787/orders/order-1 -d '{"type":"deliver"}'
```

Each order id maps to its own Durable Object, so `order-2` starts from scratch. Sending an event the current state does not accept returns `409` with the current state. State survives `wrangler dev` restarts because it lives in Durable Object storage, not in memory.

`pnpm deploy` publishes it (`wrangler deploy`); the Durable Object migration in `wrangler.jsonc` runs on first deploy.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then every request responds with the order's current state, context, and the events it will accept next.
