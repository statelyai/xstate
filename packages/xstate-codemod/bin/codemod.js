#!/usr/bin/env node
import { main, verifyCli } from '../dist/xstate-codemod.js';

const argv = process.argv.slice(2);
const [command] = argv;

// Set the exit code instead of calling process.exit() so a large JSON report
// written to a pipe is flushed before the process ends.
process.exitCode =
  command === 'baseline' || command === 'verify'
    ? await verifyCli(argv)
    : main(argv);
