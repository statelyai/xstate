import type { SourceFile } from 'ts-morph';

export interface TransformResult {
  changed: boolean;
  notes: string[];
}

export interface Transform {
  name: string;
  description: string;
  apply(sourceFile: SourceFile): TransformResult;
}
