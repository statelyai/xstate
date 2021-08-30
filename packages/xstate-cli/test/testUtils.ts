import { program } from '../src/program';

const runCli = async (cmd: string) => {
  return new Promise((resolve, reject) => {
    program
      .exitOverride()
      .configureOutput({
        writeOut: resolve,
        writeErr: reject
      })
      .parse(['', '', ...cmd.split(' ')]);
  });
};

export const testUtils = {
  runCli
};
