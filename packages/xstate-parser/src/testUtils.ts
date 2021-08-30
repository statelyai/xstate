import fs from 'fs';
import path from 'path';
import * as XStateParser from './index';

const parseFileFromExamplesDir = (filename: string) => {
  const asString = fs
    .readFileSync(path.resolve(__dirname, '../examples', filename))
    .toString();

  const result = XStateParser.parseMachinesFromFile(asString);

  return result;
};

const withoutContext = <T extends { context?: any }>(
  config: T
): Omit<T, 'context'> => {
  const newConfig = {
    ...config
  };

  delete newConfig.context;

  return newConfig;
};

const serialise = (machine: any) => {
  return JSON.stringify(machine, null, 2);
};

export const testUtils = {
  parseFileFromExamplesDir,
  withoutContext,
  serialise
};
