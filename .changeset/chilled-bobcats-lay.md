---
'xstate': minor
---

Significant improvements to error handling have been made:

- Actors will no longer crash when an error is thrown in an observer (`actor.subscribe(observer)`).
- Errors will be handled by observer's `.error()` handler:
  ```ts
  actor.subscribe({
    error: (error) => {
      // handle error
    }
  });
  ```
- If an observer does not have an error handler, the error will be thrown in a clear stack so bug tracking services can collect it.
