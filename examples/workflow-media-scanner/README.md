# Media scanner workflow

<!-- CLI and dependency requirements from package.json and src/index.ts; workflow and filesystem behavior from src/mediaScannerMachine.ts and src/fileHandlers.ts. -->

This XState v6 alpha workflow scans the immediate subdirectories of a media library, checks access, and probes supported video files. When a video exceeds 1920 pixels wide and 1080 pixels high, it moves that video's containing directory to the destination. Multiple qualifying videos in one directory cause one move. Existing destination directories are never overwritten.

Install `ffprobe` (included with [FFmpeg](https://ffmpeg.org/download.html)) and put it on `PATH`. From the repository root, run `pnpm install` and `pnpm build`. Then, in this directory:

```sh
pnpm start '/path/to/media library' '/path/to/large videos'
```

Both paths are required. The CLI performs real directory moves; use directories you intend to reorganize. The source must contain at least one accessible immediate subdirectory. Source directory symlinks are not followed. A corrupt video does not prevent scanning other files in its directory. The scanner reports inaccessible paths, probe failures, and move failures. No qualifying videos is a successful scan. CLI errors set a failing exit code.

The machine accepts `START_SCAN` in `idle`; `RESTART` returns from `ReportingErrors` to `idle`. Starting another scan clears the previous scan's result lists. Probe subprocesses receive arguments without a shell, respect actor cancellation, and time out after 30 seconds.

`pnpm build` checks types. From the repository root, run:

```sh
pnpm exec vitest run --config scripts/vitest-examples.config.mts examples/workflow-media-scanner
```

These tests mock filesystem moves and ffprobe. They cover workflow progression, permission and move errors, duplicate parent directories, existing destinations, corrupt files, audio-first stream metadata, and subprocess/JSON failures. They do not move a real media library or validate an installed FFmpeg binary.
