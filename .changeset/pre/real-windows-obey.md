---
"xstate": minor
---

Add typed transition rejections with `schemas.rejections`, `reject([...])`, and `snapshot.check(event)`. Checks return acceptance status and rejection reasons without executing effects. Parallel regions can partially accept an event. JSON definitions support guarded `reject` branches.

```ts
on: {
  submit: ({ context, reject }) => {
    if (!context.email) {
      return reject([{ type: 'email.required' }]);
    }
    return { target: 'submitting' };
  }
}
```
