import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Returns every subdirectory of `basePath`. */
export async function scanDirectories(basePath: string) {
  const entries = await fs.readdir(basePath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(basePath, entry.name));

  if (directories.length === 0) {
    throw new Error(`No directories found in ${basePath}`);
  }

  return directories;
}

/** Splits directories into the readable/writable ones and the rest. */
export async function checkFilePermissions(directories: string[]) {
  console.log('Checking directory permissions...');

  const results = await Promise.all(
    directories.map(async (dir) => {
      try {
        await fs.access(dir, fs.constants.R_OK | fs.constants.W_OK);
        return { dir, accessible: true };
      } catch (error) {
        console.error(`Cannot access directory ${dir}:`, error);
        return { dir, accessible: false };
      }
    })
  );

  const dirsToEvaluate = results.filter((r) => r.accessible).map((r) => r.dir);
  const dirsToReport = results.filter((r) => !r.accessible).map((r) => r.dir);

  if (dirsToEvaluate.length === 0) {
    throw new Error('No accessible directories found');
  }

  return { dirsToEvaluate, dirsToReport };
}

/** Returns the media files larger than 1080p, which are assumed to be 4K. */
export async function evaluateFiles(
  dirsToEvaluate: string[],
  acceptedFileTypes: string[]
) {
  console.log('Checking files in directories...');
  const dirsToMove: string[] = [];

  for (const dir of dirsToEvaluate) {
    const filenames = await fs.readdir(dir);

    for (const file of filenames) {
      const extension = path.extname(file).slice(1);

      if (!acceptedFileTypes.includes(extension)) continue;

      const filePath = path.join(dir, file);
      const { width, height } = await probeDimensions(filePath);

      if (width > 1920 && height > 1080) {
        console.log(`${file} is larger than 1080p; assuming 4K`);
        dirsToMove.push(filePath);
      }
    }
  }

  if (dirsToMove.length === 0) {
    throw new Error('No files found to move');
  }

  return { dirsToMove };
}

/** Moves the parent directory of each file to the destination library. */
export async function moveFiles(
  filePaths: string[],
  destinationBasePath: string
) {
  console.log('Moving files...');
  const errors: Array<{ source: string; destination: string }> = [];

  for (const filePath of filePaths) {
    const sourceDir = path.dirname(filePath);
    const destinationDir = path.join(
      destinationBasePath,
      path.basename(sourceDir)
    );

    try {
      await fs.mkdir(destinationBasePath, { recursive: true });
      await fs.rename(sourceDir, destinationDir);
      console.log(`Moved ${sourceDir} to ${destinationDir}`);
    } catch (error) {
      console.error(`Failed to move ${sourceDir} to ${destinationDir}`, error);
      errors.push({ source: sourceDir, destination: destinationDir });
    }
  }

  return errors.length > 0
    ? { message: 'Files moved with errors', errors }
    : { message: 'All files moved successfully', errors };
}

/** Reads the dimensions of the first video stream with `ffprobe`. */
async function probeDimensions(filePath: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'json',
    filePath
  ]);

  const stream = (
    JSON.parse(stdout) as {
      streams?: Array<{ width?: number; height?: number }>;
    }
  ).streams?.[0];

  return { width: stream?.width ?? 0, height: stream?.height ?? 0 };
}
