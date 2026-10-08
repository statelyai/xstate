# Fix: Add runtime warning for unknown delay keys in `after` transitions

## Problem

According to the XState documentation, delays should be typed when defined in `setup()`. However, due to a TypeScript limitation (issue #55709), the compiler cannot properly validate delay keys in `after` transitions when using `setup().createMachine()`.

Additionally, when an unknown delay key is referenced at runtime, the machine silently treats it as an immediate transition (no delay), which can lead to unexpected behavior that's difficult to debug.

## Solution

### 1. Runtime Warning (Development Mode)

Added a development-mode warning in `packages/core/src/actions/raise.ts` that alerts developers when they reference an unknown delay key:

```typescript
if (isDevelopment && configDelay === undefined) {
  console.warn(
    `Delay "${delay}" is not configured in \`delays\`. The event will be raised immediately. ` +
      `This is likely a mistake. Available delays: ${Object.keys(delaysMap || {}).join(', ') || 'none'}.`
  );
}
```

This warning helps developers catch delay configuration mistakes during development.

### 2. Test Coverage

Added comprehensive tests in `packages/core/test/delays.test.ts` that verify:
- Warning is shown when unknown delay is referenced
- Warning is shown when no delays are configured
- No warning for numeric delays
- No warning for properly configured delays  
- Immediate transition behavior is documented

### 3. Documentation

Updated type test comments in `packages/core/test/setup.types.test.ts` to clarify that the TypeScript limitation is known and that runtime warnings provide the safety net.

## TypeScript Limitation

The `@x-ts-expect-error` annotations in the type tests reference TypeScript issue #55709, which prevents proper narrowing of mapped types with string unions. This is a compiler limitation, not an XState issue.

However, XState DOES provide type checking when using `createMachine` directly with `types: { delays: ... }`:

```typescript
createMachine({
  types: {} as {
    delays: 'one second' | 'one minute';
  },
  after: {
    // @ts-expect-error - properly caught!
    'unknown delay': {}
  }
});
```

## Testing

Run the new tests:
```bash
pnpm -C packages/core test delays.test.ts
```

Run all tests:
```bash
pnpm test
```

## Breaking Changes

None. This change only adds development-mode warnings and does not modify runtime behavior or public APIs.
