import * as fs from 'fs/promises';
import * as fsExtra from 'fs-extra';
import path, { dirname, resolve } from 'path';
import probe from 'node-ffprobe';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'fileHandlers' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

export async function scanDirectories(basePath: string) {
  try {
    const files = await fs.readdir(basePath);
    const validDirectories: string[] = [];

    for (const file of files) {
      const fullPath = basePath + '/' + file;
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        validDirectories.push(fullPath);
      }
    }

    if (validDirectories.length === 0) {
      throw new Error('No valid directories found');
    }

    return validDirectories;
  } catch (error) {
    throw new Error('Unable to scan directory: ' + error.message);
  }
}

export async function checkFilePermissions(directories: string[]) {
  try {
    logger.info('checking directory permissions...');

    const promises = directories.map(async (dir) => {
      try {
        await fs.access(dir, fs.constants.R_OK | fs.constants.W_OK);
        logger.info(`directory ${dir} is accessible`);
        return { dir, status: 'accessible' };
      } catch (err) {
        logger.error(`cannot access directory ${dir}. Error: ${err}`);
        return { dir, status: 'inaccessible', error: err };
      }
    });

    const results = await Promise.all(promises);

    const dirsToEvaluate = results
      .filter((result) => result.status === 'accessible')
      .map((result) => result.dir);
    const dirsToReport = results
      .filter((result) => result.status === 'inaccessible')
      .map((result) => result.dir);

    if (dirsToEvaluate.length === 0) {
      throw { message: 'No accessible files found to move', dirsToReport };
    }

    return { dirsToEvaluate, dirsToReport };
  } catch (error) {
    throw { message: 'Error checking file permissions', error };
  }
}

export async function evaluateFiles(
  dirsToEvaluate: string[],
  acceptedFileTypes: string[]
) {
  try {
    logger.info('checking files in directories...');
    const dirsToMove: string[] = [];

    for (const dir of dirsToEvaluate) {
      try {
        // read the directory's files
        const filenames = await fs.readdir(dir);

        // check each file's type
        for (const file of filenames) {
          // if the file is a valid type, check the file's dimensions
          const fileExtension = file.split('.').pop();
          if (fileExtension && acceptedFileTypes.includes(fileExtension)) {
            // read the file's dimensions
            const result = await probe(path.join(dir, file));
            if (
              result.streams[0].width > 1920 &&
              result.streams[0].height > 1080
            ) {
              logger.info(`file ${file} is greater than 1080p. Assuming 4K`);
              dirsToMove.push(path.join(dir, file));
            }
          }
        }
      } catch (error) {
        console.log(`error reading directory ${dir}: `, error);
        //todo: add to a collection of directories that we need to report
      }
    }

    if (dirsToMove.length === 0) {
      throw { message: 'No files found to move', dirsToMove };
    }

    return { dirsToMove };
  } catch (error) {
    throw { message: 'Error evaluating files', error };
  }
}

export async function moveFiles(
  dirsToMove: string[],
  destinationBasePath: string
) {
  try {
    logger.info('moving files...');

    const errors: Array<{ source: string; destination: string; error: any }> =
      [];

    for (const dir of dirsToMove) {
      const parentDir = path.dirname(dir);
      const newDirName = path.basename(parentDir);
      const destinationDir = path.join(destinationBasePath, newDirName);

      try {
        await fsExtra.move(parentDir, destinationDir, { overwrite: true });
        console.log(`moved ${dir} to ${destinationDir} successfully`);
      } catch (error) {
        logger.error(
          `failed to move ${dir} to ${destinationDir}. Error: ${error}`
        );
        errors.push({ source: dir, destination: destinationDir, error });
      }
    }

    if (errors.length > 0) {
      return { message: 'files moved with errors', errors };
    } else {
      return { message: 'all files moved successfully' };
    }
  } catch (error) {
    throw { message: 'Error moving files', error };
  }
}
