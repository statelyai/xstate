import { Project, SourceFile } from 'ts-morph';
import type { Transform } from './types.ts';
import { transforms as allTransforms, transformsByName } from './transforms/index.ts';

export interface FileTransformReport {
  filePath: string;
  perTransform: Array<{
    transform: string;
    changed: boolean;
    notes: string[];
  }>;
  changed: boolean;
  newText?: string;
}

export interface RunReport {
  files: FileTransformReport[];
  filesChanged: number;
  /** Notes emitted by `report-removed-apis` (manual-migration section). */
  manualMigrationNotes: string[];
}

/** Resolve a list of transform names to Transform objects. */
export function selectTransforms(names?: string[]): Transform[] {
  if (!names || names.length === 0) {
    return allTransforms;
  }
  const selected: Transform[] = [];
  for (const name of names) {
    const t = transformsByName[name];
    if (!t) {
      throw new Error(
        `Unknown transform '${name}'. Available: ${Object.keys(
          transformsByName
        ).join(', ')}`
      );
    }
    selected.push(t);
  }
  return selected;
}

/** Applies the given transforms to a single source file (in-memory). */
export function applyToSourceFile(
  sourceFile: SourceFile,
  transforms: Transform[]
): FileTransformReport {
  const perTransform: FileTransformReport['perTransform'] = [];
  let changed = false;

  for (const transform of transforms) {
    const result = transform.apply(sourceFile);
    perTransform.push({
      transform: transform.name,
      changed: result.changed,
      notes: result.notes
    });
    if (result.changed) {
      changed = true;
    }
  }

  return {
    filePath: sourceFile.getFilePath(),
    perTransform,
    changed,
    newText: changed ? sourceFile.getFullText() : undefined
  };
}

/**
 * Runs the selected transforms over the given files.
 *
 * @param filePaths absolute or cwd-relative file paths to process
 * @param transforms the transforms to apply
 * @param options.write when true, saves modified files to disk
 */
export function run(
  filePaths: string[],
  transforms: Transform[],
  options: { write: boolean } = { write: false }
): RunReport {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true
    }
  });

  const files: FileTransformReport[] = [];
  const manualMigrationNotes: string[] = [];
  let filesChanged = 0;

  for (const filePath of filePaths) {
    const sourceFile = project.addSourceFileAtPath(filePath);
    const report = applyToSourceFile(sourceFile, transforms);

    for (const pt of report.perTransform) {
      if (pt.transform === 'report-removed-apis') {
        manualMigrationNotes.push(...pt.notes);
      }
    }

    if (report.changed) {
      filesChanged++;
      if (options.write) {
        sourceFile.saveSync();
      }
    }
    files.push(report);
  }

  return { files, filesChanged, manualMigrationNotes };
}
