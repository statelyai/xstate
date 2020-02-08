import { DiffPatcher } from 'jsondiffpatch';

const defaultObjectHash = (o, idx) =>
  o === null && '$$null' ||
  o && (o.id || o.id === 0) && `$$id:${JSON.stringify(o.id)}` ||
  o && (o._id ||o._id === 0) && `$$_id:${JSON.stringify(o._id)}` ||
  '$$index:' + idx;

const defaultPropertyFilter = (name, context) =>
  typeof context.left[name] !== 'function' &&
  typeof context.right[name] !== 'function';

const defaultDiffPatcher = new DiffPatcher({
  arrays: { detectMove: false },
  objectHash: defaultObjectHash,
  propertyFilter: defaultPropertyFilter
});

export default function createDiffPatcher() {
  return defaultDiffPatcher;
}