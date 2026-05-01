## '@xstate/store': major

Added `createAsyncStore(...)` for async step-based transition handlers.

Use `enq.step(stepId, exec)` inside an async transition to run async work as an explicit step. Active and completed async steps are stored in `snapshot.async` using a step status shape.

```ts
import { createAsyncStore } from '@xstate/store';

const store = createAsyncStore({
  context: {
    user: undefined
  },
  on: {
    loadUser: async (context, event: { id: string }, enq) => {
      const user = await enq.step('fetchUser', () =>
        fetch(`/users/${event.id}`).then((response) => response.json())
      );

      return {
        ...context,
        user
      };
    }
  }
});
```
