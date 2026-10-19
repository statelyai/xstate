# Add development-mode warning for unknown delay keys in `after` transitions

## Summary

Fixes the issue where unknown delay keys in `after` transitions are silently treated as immediate transitions, making it difficult to debug configuration mistakes.

## Problem

When using `setup().createMachine()` with delays configured:

```typescript
const machine = setup({
  delays: {
    slotDuration: 100
  }
}).createMachine({
  states: {
    sleep: {
      after: {
        slotDuration222: 'wake' // Typo! But no error shown
      }
    },
    wake: {}
  }
});
```

**Current behavior:**
1. TypeScript doesn't catch the typo due to a compiler limitation (TS#55709)
2. Runtime silently treats the unknown delay as immediate transition
3. Machine transitions instantly instead of waiting, causing hard-to-debug issues

**Expected behavior:**
- Developers should be warned about the misconfiguration
- The issue should be caught during development

## Solution

### 1. Runtime Warning (Development Mode Only)

Added a warning in `packages/core/src/actions/raise.ts` that triggers when an unknown delay key is referenced:

```typescript
if (isDevelopment && configDelay === undefined) {
  console.warn(
    `Delay "${delay}" is not configured in \`delays\`. The event will be raised immediately. ` +
      `This is likely a mistake. Available delays: ${Object.keys(delaysMap || {}).join(', ') || 'none'}.`
  );
}
```

**Example output:**
```
Delay "slotDuration222" is not configured in `delays`. The event will be raised immediately. This is likely a mistake. Available delays: slotDuration.
```

### 2. Comprehensive Test Coverage

Added `packages/core/test/delays.test.ts` with tests covering:
- ✅ Warning when unknown delay is referenced
- ✅ Warning when no delays are configured
- ✅ No warning for numeric delays  
- ✅ No warning for properly configured delays
- ✅ Documented immediate transition behavior

### 3. Documentation Updates

Updated type test comments in `packages/core/test/setup.types.test.ts` to clarify:
- The TypeScript limitation (TS#55709) is known
- Runtime warnings provide the safety net
- The issue is a compiler limitation, not an XState bug

## TypeScript Limitation Explained

The `@x-ts-expect-error` annotations in type tests reference [TypeScript issue #55709](https://github.com/microsoft/TypeScript/issues/55709), which prevents proper narrowing of mapped types with string unions when used in `setup().createMachine()`.

However, XState DOES provide type checking when using `createMachine` directly:

```typescript
createMachine({
  types: {} as {
    delays: 'one second' | 'one minute';
  },
  after: {
    'unknown delay': {} // @ts-expect-error - properly caught!
  }
});
```

## Changes

### Modified Files
1. **packages/core/src/actions/raise.ts** - Added development-mode warning
2. **packages/core/test/setup.types.test.ts** - Updated comments to clarify known TypeScript limitation
3. **packages/core/test/delays.test.ts** - NEW: Added comprehensive runtime tests

### Breaking Changes
None. This change:
- Only adds development-mode warnings (not in production)
- Does not modify runtime behavior
- Does not change public APIs
- Is fully backward compatible

## Testing

The new tests can be run with:
```bash
pnpm -C packages/core test delays.test.ts
```

All existing tests should still pass:
```bash
pnpm test
```

## Related Issues

Addresses the reported issue where:
- TypeScript doesn't catch unknown delay keys in `after` transitions when using `setup()`
- Unknown delays cause immediate transitions without warning
- Developers have difficulty debugging delay configuration mistakes

## Benefits

1. **Better Developer Experience**: Clear warning messages help catch mistakes early
2. **Maintains Performance**: Warning only runs in development mode
3. **Backward Compatible**: Existing code continues to work without changes
4. **Documented**: Tests and comments clarify the TypeScript limitation
