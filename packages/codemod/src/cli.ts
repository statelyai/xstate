#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { transformSource } from './transforms.js';

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'build']);

interface Options {
  dryRun: boolean;
  paths: string[];
}

function parseArgs(argv: string[]): Options {
  const paths: string[] = [];
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '-d') dryRun = true;
    else if (!arg.startsWith('-')) paths.push(arg);
  }
  return { dryRun, paths: paths.length ? paths : ['.'] };
}

async function* walk(target: string): AsyncGenerator<string> {
  const stat = await fs.stat(target);
  if (stat.isFile()) {
    if (EXTENSIONS.has(path.extname(target))) yield target;
    return;
  }
  for (const entry of await fs.readdir(target, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name))
        yield* walk(path.join(target, entry.name));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      yield path.join(target, entry.name);
    }
  }
}

async function main() {
  const { dryRun, paths } = parseArgs(process.argv.slice(2));
  let scanned = 0;
  let changed = 0;
  const allNotes: string[] = [];

  for (const root of paths) {
    for await (const file of walk(root)) {
      scanned++;
      const before = await fs.readFile(file, 'utf8');
      const result = transformSource(file, before);
      for (const note of result.notes) allNotes.push(`${file}: ${note}`);
      if (result.changed && result.code !== before) {
        changed++;
        if (dryRun) {
          console.log(`would update ${file}`);
        } else {
          await fs.writeFile(file, result.code);
          console.log(`updated ${file}`);
        }
      }
    }
  }

  console.log(
    `\n${dryRun ? 'Dry run: ' : ''}${changed} file(s) ${
      dryRun ? 'would be ' : ''
    }changed of ${scanned} scanned.`
  );
  if (allNotes.length) {
    console.log(`\nManual review (${allNotes.length}):`);
    for (const note of allNotes) console.log(`  - ${note}`);
  }
  console.log(
    '\nTier A (renames) only. Inline-function transforms (assign/guard/actions →' +
      ' functions) and schemas are not yet automated — see migration.md.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
