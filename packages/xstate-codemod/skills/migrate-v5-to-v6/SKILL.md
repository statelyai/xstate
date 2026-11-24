---
name: migrate-v5-to-v6
description: Use when converting an XState v5 machine file to v6 and checking that the converted machine behaves like the original.
---

Run these steps for one machine file at a time. `<name>` is a short name for the file.

1. Record the v5 behavior before editing the file:

   ```bash
   npx @xstate/codemod baseline <file> --out .xstate-migrate/<name>.json
   ```

   Add `--events events.json` when events carry payloads. The file maps each event type to a list of payloads:
   `{ "ADD_ITEM": [{ "type": "ADD_ITEM", "sku": "A1" }] }`.
   Event types without an entry are sent as `{ type }`.

   Add `--stubs stubs.json` when the machine invokes or spawns actors by name. Each actor is `"pending"` (the default), `{ "done": output }`, or `{ "error": value }`:
   `{ "actors": { "fetchUser": { "done": { "id": 1 } } }, "delays": { "RETRY": 100 } }`.
   `delays` sets named delays in milliseconds. `{}` resolves with `undefined` and `{ "done": null }` resolves with `null`. One baseline holds one outcome per actor, so cover `onError` paths with a second baseline that uses a different `--stubs` file.

   Add `--input input.json` when the machine reads `input`.

   If baseline times out, pass `--no-simple-paths`.

2. Convert the file:

   ```bash
   npx @xstate/codemod migrate <file> --json
   ```

   Exit 0: continue. Exit 2: fix every `manualSites` entry by hand, using its `api` and `hint` and `docs/xstate-v5-to-v6.md`. Change nothing else.

3. Check the behavior:

   ```bash
   npx @xstate/codemod verify --baseline .xstate-migrate/<name>.json <file> --json
   ```

   - If the report has `startError`, exit 0 proves nothing: fix the input/stubs until it clears, then rerun.
   - Exit 0: done.
   - Exit 4: fix the load or run error described in `error.message`, then rerun.
   - Exit 3: for each `diffs[]` entry with `classification: "unclassified"`, reproduce it with `witness` (the events and clock advances up to `step`), compare `expected` (v5) with `actual` (v6) for `field`, fix the v6 code, then rerun step 3.

   Repeat step 3 until it exits 0.

Rules:

- Never edit the baseline file.
- Never widen `--compare` to make a diff disappear.
- Report every `unstubbed` entry to the user. Inline actor logic runs for real and is not stubbed.
- Stop and ask the user after 5 repair rounds without exit 0.

The `string-targets` transform also wraps inline `xstate/fsm` targets in `on` and `always`, including `setup(...).createFSM` and aliased `createFSM` imports. It preserves string `initial` values. Review separately stored configurations and string-returning transition functions manually.
