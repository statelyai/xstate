# Persisted donut workflow with MongoDB

<!-- Runtime commands from package.json; MongoDB configuration and lifecycle from main.ts and session.ts. -->

This XState v6 alpha example restores a donut workflow from MongoDB and persists each new snapshot in event order. Snapshots are captured before entering the write queue. A failed write is reported without preventing later writes.

From the repository root, run `pnpm install` and `pnpm build`. Then, in this directory:

```sh
MONGODB_URI='mongodb://localhost:27017' pnpm start
```

The sample uses the `donut-maker` database and `donuts` collection. It restores the first document containing `persistedState`, or creates one when absent. Use a dedicated collection for this single-workflow example. Enter one displayed event per line. Ctrl-C or stdin closure stops the actor, drains pending writes, and closes the connection.

`pnpm build` checks types. Repository example tests use an in-memory persistence callback to verify ordering, failure recovery, and restoration; they do not connect to a live database.
