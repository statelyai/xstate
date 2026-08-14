# document-collab-sync

## What it teaches

Server-authoritative document sync: a server actor holds the canonical version, client actors submit operations against a base version, and a client that is out of date is rejected, resyncs, and replays its operation.

## XState features used

- `setup()` with `schemas`
- machine-level `on` handler as a request router (server)
- transition functions that branch on context instead of a guard key
- `reenter: true` to re-enter `submitted` on each retry
- final state `output` for the give-up path

## Run it

```bash
pnpm install
pnpm start
```

Two clients edit from v0 at the same time. `client-a` lands on v1; `client-b` is rejected, adopts v1 and rebases its own edit onto it, producing `"Hello World"` at v2. Everything runs in one process — the "network" is a pair of functions with a 60 ms delay — so the example needs no server.

A client gives up after `MAX_REBASES` attempts and ends in `conflicted`, which is where a real editor would surface a merge conflict.

The `start` script passes `--conditions=module` so that Node resolves `xstate` to this repo's source.

## Inspect it

Inspector: pending v6-compatible `@statelyai/inspect`. Until then the example logs every submission, acceptance and rebase.
