---
'xstate': minor
---

Added offline test suites to `xstate/graph`. `generateTestSuite()`
records the traces a passing `propertyTest()` campaign explored and keeps a
minimal, coverage-preserving subset of them as portable replay fixtures. The
suite is plain JSON, so it can be committed and replayed in CI without the
generator adapter installed.

```ts
const suite = await generateTestSuite(machine, {
  adapter,
  events,
  invariant
});

await writeFile('suite.json', serializeTestSuite(suite));
```

```ts
// In CI, with no generator adapter installed:
const suite = parseTestSuite(await readFile('suite.json', 'utf8'));
const { passed, failed } = await replayTestSuite(machine, suite, {
  invariant
});
```

`describeTestSuite(suite, machine, { invariant })` registers one test per
fixture with Vitest or Jest, and `parseTestSuite()` rejects suites written
in an unknown format version.
