# Summary of Changes for PR

## Files Modified

### 1. `packages/core/src/actions/raise.ts`
**Change**: Added development-mode warning when an unknown delay key is referenced

**Code Added**:
```typescript
if (isDevelopment && configDelay === undefined) {
  console.warn(
    `Delay "${delay}" is not configured in \`delays\`. The event will be raised immediately. ` +
      `This is likely a mistake. Available delays: ${Object.keys(delaysMap || {}).join(', ') || 'none'}.`
  );
}
```

### 2. `packages/core/test/setup.types.test.ts`
**Change**: Updated comments for two test cases to clarify the TypeScript limitation

**Tests Updated**:
- "should not accept an after transition that references an unknown delay when delays are configured"
- "should not accept an after transition that references an unknown delay when delays are not configured"

**Comment Added**:
```typescript
// @x-ts-expect-error https://github.com/microsoft/TypeScript/issues/55709
// TypeScript limitation: mapped types with string unions don't narrow properly.
// A dev-mode runtime warning will be shown for this.
```

### 3. `packages/core/test/delays.test.ts` (NEW FILE)
**Change**: Created comprehensive runtime tests for delay behavior

**Tests Added**:
- ✅ Warns when unknown delay is referenced (with configured delays)
- ✅ Warns when unknown delay is referenced (without configured delays)
- ✅ No warning for numeric delays
- ✅ No warning for properly configured delays
- ✅ Documents immediate transition behavior for unknown delays

## Key Points

### Problem Solved
- Users couldn't catch typos in delay keys at compile time (TypeScript limitation)
- Unknown delays caused immediate transitions without any warning
- Difficult to debug delay configuration mistakes

### Solution Approach
- Added development-mode runtime warning (no production overhead)
- Comprehensive test coverage
- Documentation of TypeScript limitation
- Fully backward compatible

### TypeScript Limitation
The issue is due to TypeScript #55709 - mapped types with string unions don't properly narrow in certain contexts. This affects `setup().createMachine()` but NOT `createMachine()` with `types: { delays: ... }`.

## How to Use This PR

### For PR Description
Use the content from `/workspaces/xstate/PR_DESCRIPTION.md`

### For Commit Message
```
fix(core): add dev-mode warning for unknown delay keys in after transitions

Adds a development-mode warning when an unknown delay key is referenced
in `after` transitions. This helps developers catch configuration mistakes
that TypeScript cannot detect due to a compiler limitation (TS#55709).

The warning only runs in development mode and does not affect production.

Fixes: [Issue Number]
```

### Testing Instructions
```bash
# Run new delay tests
pnpm -C packages/core test delays.test.ts

# Run all tests
pnpm test
```

## Benefits
1. **Better DX**: Clear warnings help catch mistakes early
2. **Zero Runtime Cost**: Only runs in development mode  
3. **Backward Compatible**: No breaking changes
4. **Well Documented**: Tests and comments explain the TypeScript limitation
