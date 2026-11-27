---
'@xstate/codemod': minor
---

Add the `report-input-mutations` transform. It reports, without rewriting, in-place writes to `input` inside `fromPromise`, `fromCallback`, `createAsyncLogic`, and `createCallbackLogic` logic functions. v6 development builds deep-freeze context, so writing to input built from context throws a `TypeError` at runtime.

```ts
// reported
const decrypt = createAsyncLogic({
  run: async ({ input }) => {
    input.note.text = await decryptText(input.note.text);
    return input.note;
  }
});

// fix: return a new object
const decrypt = createAsyncLogic({
  run: async ({ input }) => ({
    ...input.note,
    text: await decryptText(input.note.text)
  })
});
```
