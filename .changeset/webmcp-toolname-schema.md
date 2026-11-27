---
'@xstate/webmcp': minor
---

The `toolName` option now receives the event schema as its second argument, so a tool name can depend on the schema.

```ts
createWebMCP(todoStore, {
  events: ['todo.*'],
  toolName: (eventType, schema) =>
    schema === todoStore.schemas?.events?.['todo.add']
      ? 'add_todo'
      : toToolName(eventType)
});
```
