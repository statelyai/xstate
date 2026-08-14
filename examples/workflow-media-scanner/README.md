# workflow-media-scanner

## What it teaches

A backend workflow that chains long-running file system tasks: each step is an invoked async actor whose output becomes the input of the next state.

## XState features used

- `setup()` with schemas, named actors and actions
- `createAsyncLogic` for the scan, permission, evaluate and move steps
- `invoke` with `onDone` / `onError` and a shared error state
- `input` to seed context

## Run it

This example shells out to `ffprobe`, which ships with [ffmpeg](https://ffmpeg.org/download.html), to read video dimensions.

```bash
pnpm install
MEDIA_BASE_PATH=/path/to/library \
MEDIA_DESTINATION_PATH=/path/to/4k-library \
pnpm start
```

The scanner walks each subdirectory of `MEDIA_BASE_PATH`, and moves the directories containing video above 1080p into `MEDIA_DESTINATION_PATH`. It moves directories with `fs.rename`, so both paths must be on the same filesystem.

The `start` script uses `vite-node` so that `xstate` resolves to this repo's source.

> This example moves files on your disk. Point it at a copy of your library first.

## Inspect it

Inspector: pending v6-compatible `@statelyai/inspect` (the current release peers on `xstate@^5`).
