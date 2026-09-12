# Persisted donut maker

<!-- CLI commands from package.json; persistence behavior from main.ts and snapshotWriter.ts. -->

Run `pnpm start` from this directory, then enter one event displayed by the CLI per line. `pnpm build` checks types; `pnpm test` checks persistence.

The XState v6 alpha actor restores `persisted-state.json` from the current directory. A missing file starts a new workflow; invalid or unreadable files stop startup.

Snapshots write serially to temporary files and atomically replace the saved file. While a write runs, newer snapshots replace the pending snapshot, bounding the queue. Ctrl-C or stdin closure stops the actor and waits for pending storage. Write failures are reported and set a failing exit code.
