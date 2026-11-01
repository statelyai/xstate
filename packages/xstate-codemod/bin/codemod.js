#!/usr/bin/env node
import { main, verifyCli } from '../dist/xstate-codemod.js';

const argv = process.argv.slice(2);
const [command] = argv;

process.exit(
  command === 'baseline' || command === 'verify'
    ? await verifyCli(argv)
    : main(argv)
);
