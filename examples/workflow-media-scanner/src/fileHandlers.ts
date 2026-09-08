import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { move } from 'fs-extra';
import path from 'node:path';
import { readVideoStreams } from './probe';

export class PermissionError extends Error {
  constructor(public readonly dirsToReport: string[]) {
    super('No accessible directories found');
  }
}

export async function scanDirectories(basePath: string) {
  const entries = await fs.readdir(basePath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(basePath, entry.name));
  if (!directories.length) throw new Error('No valid directories found');
  return directories;
}

export async function checkFilePermissions(directories: string[]) {
  const results = await Promise.all(
    directories.map(async (dir) => {
      try {
        await fs.access(dir, constants.R_OK | constants.W_OK);
        return { dir, accessible: true };
      } catch {
        return { dir, accessible: false };
      }
    })
  );
  const dirsToEvaluate = results
    .filter((result) => result.accessible)
    .map((result) => result.dir);
  const dirsToReport = results
    .filter((result) => !result.accessible)
    .map((result) => result.dir);
  if (!dirsToEvaluate.length) throw new PermissionError(dirsToReport);
  return { dirsToEvaluate, dirsToReport };
}

export async function evaluateFiles(
  dirsToEvaluate: string[],
  acceptedFileTypes: string[],
  signal?: AbortSignal
) {
  const accepted = new Set(
    acceptedFileTypes.map((extension) => extension.toLowerCase())
  );
  const dirsToMove: string[] = [];
  const dirsToReport: string[] = [];
  for (const directory of dirsToEvaluate) {
    signal?.throwIfAborted();
    let filenames: string[];
    try {
      filenames = await fs.readdir(directory);
    } catch {
      dirsToReport.push(directory);
      continue;
    }
    for (const filename of filenames) {
      signal?.throwIfAborted();
      if (!accepted.has(path.extname(filename).slice(1).toLowerCase()))
        continue;
      const file = path.join(directory, filename);
      try {
        const streams = await readVideoStreams(file, signal);
        if (
          streams.some((stream) => stream.width > 1920 && stream.height > 1080)
        )
          dirsToMove.push(file);
      } catch (error) {
        if (signal?.aborted) throw error;
        // One bad probe must not hide later valid files in the same directory.
        dirsToReport.push(file);
      }
    }
  }
  return { dirsToMove, dirsToReport };
}

export async function moveFiles(
  dirsToMove: string[],
  destinationBasePath: string
) {
  const errors: Array<{ source: string; destination: string; error: unknown }> =
    [];
  const processedFiles: string[] = [];
  // Multiple qualifying videos in one directory still require only one move.
  const parents = new Set(
    dirsToMove.map((file) => path.resolve(path.dirname(file)))
  );
  for (const source of parents) {
    const destination = path.resolve(
      destinationBasePath,
      path.basename(source)
    );
    try {
      await move(source, destination, { overwrite: false });
      processedFiles.push(source);
    } catch (error) {
      errors.push({ source, destination, error });
    }
  }
  return { errors, processedFiles };
}
