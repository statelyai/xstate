---
'@xstate/test': minor
---

Added offline test suites to `@xstate/test`. `generateTestSuite()`
records the traces a passing `propertyTest()` campaign explored and keeps a
minimal, coverage-preserving subset of them as portable replay fixtures. The
suite is plain JSON, so it can be committed and replayed in CI without
generating new sequences.

```ts
const suite = await generateTestSuite(machine, {
  events,
  invariant
});

await writeFile('suite.json', serializeTestSuite(suite));
```

```ts
// In CI:
const suite = parseTestSuite(await readFile('suite.json', 'utf8'));
const { passed, failed } = await replayTestSuite(machine, suite, {
  invariant
});
```

`describeTestSuite(suite, machine, { invariant })` registers one test per
fixture with Vitest or Jest, and `parseTestSuite()` rejects suites written
in an unknown format version.
