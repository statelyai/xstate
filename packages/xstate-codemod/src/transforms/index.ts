import type { Transform } from '../types.ts';
import { renameImports } from './rename-imports.ts';
import { stringTargets } from './string-targets.ts';
import { typesToSchemas } from './types-to-schemas.ts';
import { reportRemovedApis } from './report-removed-apis.ts';

/** All transforms, in recommended application order. */
export const transforms: Transform[] = [
  renameImports,
  stringTargets,
  typesToSchemas,
  reportRemovedApis
];

export const transformsByName: Record<string, Transform> = Object.fromEntries(
  transforms.map((t) => [t.name, t])
);

export {
  renameImports,
  stringTargets,
  typesToSchemas,
  reportRemovedApis
};
