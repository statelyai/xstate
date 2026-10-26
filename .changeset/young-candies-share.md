---
'@xstate/effect': minor
---

Add the compiled `@xstate/effect/oxlint` plugin. Enable `xstate-effect/no-inline-effect` to catch discarded inline Effects and unsupported inline spawned Effect logic without copying a rule from the repository.

```json
{
  "jsPlugins": ["@xstate/effect/oxlint"],
  "rules": {
    "xstate-effect/no-inline-effect": "error"
  }
}
```
