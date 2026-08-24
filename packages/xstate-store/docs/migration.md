---
title: Migration
description: Update applications for the current XState Store API.
---

Upgrade the package, then update one store at a time.

```bash
npm install @xstate/store@alpha
```

Check these areas:

- Transition functions return the complete next context.
- Effects use the transition enqueue argument.
- Framework selectors use packages such as `@xstate/store-react`.
- Persistence and undo imports use their extension entry points.
- Tests send public events instead of changing context directly.

Run type checking after each store. Type errors often identify renamed events and incomplete context returns.
