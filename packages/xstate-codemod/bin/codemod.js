#!/usr/bin/env node
import { main } from '../dist/xstate-codemod.js';

process.exit(main(process.argv.slice(2)));
