import type { Transform } from '../types.ts';
import { renameImports } from './rename-imports.ts';
import { stringTargets } from './string-targets.ts';
import { typesToSchemas } from './types-to-schemas.ts';
import { reportRemovedApis } from './report-removed-apis.ts';
import { reportIdPathTargets } from './report-id-path-targets.ts';
import { reportSuffixedLifecycleEvents } from './report-suffixed-lifecycle-events.ts';
import { reportActionShapes } from './report-action-shapes.ts';
import { reportImplementations } from './report-implementations.ts';

/** All transforms, in recommended application order. */
export const transforms: Transform[] = [
  renameImports,
  stringTargets,
  typesToSchemas,
  reportRemovedApis,
  reportIdPathTargets,
  reportSuffixedLifecycleEvents,
  reportActionShapes,
  reportImplementations
];

export const transformsByName: Record<string, Transform> = Object.fromEntries(
  transforms.map((t) => [t.name, t])
);

export {
  renameImports,
  stringTargets,
  typesToSchemas,
  reportRemovedApis,
  reportIdPathTargets,
  reportSuffixedLifecycleEvents,
  reportActionShapes,
  reportImplementations
};
