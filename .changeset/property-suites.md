---
'xstate': minor
---

Added offline property suites to `xstate/graph`. `generatePropertySuite()`
records the traces a passing `propertyTest()` campaign explored and keeps a
minimal, coverage-preserving subset of them as portable replay fixtures. The
suite is plain JSON, so it can be committed and replayed in CI without the
generator adapter installed.

```ts
const suite = await generatePropertySuite(machine, {
  adapter: fastCheckAdapter(),
  events,
  invariant
});

await writeFile('suite.json', serializePropertySuite(suite));
```

```ts
// In CI, with no generator adapter installed:
const suite = parsePropertySuite(await readFile('suite.json', 'utf8'));
const { passed, failed } = await replayPropertySuite(machine, suite, {
  invariant
});
```

`describePropertySuite(suite, machine, { invariant })` registers one test per
fixture with Vitest or Jest, and `parsePropertySuite()` rejects suites written
in an unknown format version.
