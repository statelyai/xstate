/** @type {import('jest-resolve').SyncResolver} */
module.exports = (path, options) => {
  return options.defaultResolver(path, {
    ...options,
    conditions: Array.from(
      new Set([...(options.conditions || []), 'development', 'require'])
    )
  });
};
