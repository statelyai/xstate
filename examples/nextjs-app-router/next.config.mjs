// The monorepo has lockfiles above this directory, so the file-tracing root is
// pinned here to keep the build output scoped to the example.
/** @type {import('next').NextConfig} */
export default {
  outputFileTracingRoot: import.meta.dirname
};
