import type { SourceFile } from 'ts-morph';

/** A source location that needs manual migration. */
export interface ManualSite {
  file: string;
  line: number;
  column: number;
  api: string;
  hint: string;
}

export interface TransformResult {
  changed: boolean;
  notes: string[];
  sites?: ManualSite[];
}

export interface Transform {
  name: string;
  description: string;
  apply(sourceFile: SourceFile): TransformResult;
}
