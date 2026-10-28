---
'@xstate/effect': minor
---

Add the compiled `@xstate/effect/oxlint` plugin. Enable `xstate-effect/no-inline-effect` to catch discarded inline Effects and unsupported inline spawned Effect logic without copying a rule from the repository.

`@xstate/effect` keeps zero direct runtime dependencies. Install the optional lint tools as development dependencies before enabling the plugin:

```sh
npm install --save-dev oxlint@^1.76.0 @oxlint/plugins@^1.76.0
```

```json
{
  "jsPlugins": ["@xstate/effect/oxlint"],
  "rules": {
    "xstate-effect/no-inline-effect": "error"
  }
}
```
