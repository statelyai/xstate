import process from 'node:process';
import { Project } from 'ts-morph';
import { run, selectTransforms } from './runner.ts';
import { transforms as allTransforms } from './transforms/index.ts';

export interface ParsedArgs {
  command: string | undefined;
  globs: string[];
  dry: boolean;
  transformNames: string[] | undefined;
  help: boolean;
}

const DEFAULT_GLOB = '**/*.{ts,tsx,js,jsx}';
const IGNORE = ['**/node_modules/**', '**/dist/**'];

/** Hand-written arg parser (no yargs). */
export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: undefined,
    globs: [],
    dry: false,
    transformNames: undefined,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--dry') {
      parsed.dry = true;
    } else if (arg === '--transform') {
      const value = argv[++i];
      if (value) {
        parsed.transformNames = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else if (arg.startsWith('--transform=')) {
      parsed.transformNames = arg
        .slice('--transform='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (!parsed.command) {
      parsed.command = arg;
    } else {
      parsed.globs.push(arg);
    }
  }

  return parsed;
}

function printHelp(): void {
  const names = allTransforms.map((t) => `    ${t.name} — ${t.description}`);
  process.stdout.write(
    [
      'xstate-codemod — migrate XState source (v5 → v6)',
      '',
      'Usage:',
      '  xstate-codemod migrate [globs...] [--dry] [--transform <name,name>]',
      '',
      'Options:',
      '  --dry                  Print a summary of changes without writing files',
      '  --transform <names>    Comma-separated transform names (default: all)',
      '  -h, --help             Show this help',
      '',
      `Default glob: ${DEFAULT_GLOB} (excludes node_modules and dist)`,
      '',
      'Transforms:',
      ...names,
      ''
    ].join('\n')
  );
}

/**
 * Resolves glob patterns into a de-duplicated list of file paths using
 * ts-morph's built-in glob support (no extra glob dependency).
 */
export function resolveFiles(globs: string[]): string[] {
  const patterns = (globs.length ? globs : [DEFAULT_GLOB]).concat(
    IGNORE.map((p) => `!${p}`)
  );
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const set = new Set<string>();
  for (const sf of project.addSourceFilesAtPaths(patterns)) {
    set.add(sf.getFilePath());
  }
  return [...set].sort();
}

/** CLI entry point. Returns a process exit code. */
export function main(argv: string[]): number {
  const args = parseArgs(argv);

  if (args.help || !args.command) {
    printHelp();
    return args.command ? 0 : args.help ? 0 : 1;
  }

  if (args.command !== 'migrate') {
    process.stderr.write(
      `Unknown command '${args.command}'. Did you mean 'migrate'?\n`
    );
    return 1;
  }

  let transforms;
  try {
    transforms = selectTransforms(args.transformNames);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }

  const files = resolveFiles(args.globs);
  if (files.length === 0) {
    process.stdout.write('No files matched.\n');
    return 0;
  }

  const report = run(files, transforms, { write: !args.dry });

  // Per-file, per-transform summary.
  for (const file of report.files) {
    const touched = file.perTransform.filter(
      (pt) => pt.changed || pt.notes.length
    );
    if (touched.length === 0) {
      continue;
    }
    process.stdout.write(
      `\n${file.filePath}${file.changed ? '' : ' (no writes)'}\n`
    );
    for (const pt of touched) {
      const mark = pt.changed ? '✔' : '·';
      process.stdout.write(`  ${mark} ${pt.transform}\n`);
      for (const note of pt.notes) {
        process.stdout.write(`      - ${note}\n`);
      }
    }
  }

  // Manual-migration section.
  if (report.manualMigrationNotes.length) {
    process.stdout.write('\n=== Manual migration needed ===\n');
    for (const note of report.manualMigrationNotes) {
      process.stdout.write(`  ${note}\n`);
    }
  }

  // Final report.
  process.stdout.write(
    `\n${args.dry ? '[dry run] ' : ''}${report.filesChanged} of ${
      files.length
    } file(s) ${args.dry ? 'would change' : 'changed'}.\n`
  );

  return 0;
}
