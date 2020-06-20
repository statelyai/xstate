---
'@xstate/vue': minor
---

chore(dep/vue) bump peerDep of @vue/composition-api to 0.6.x.

- breaking changes in 0.6.x, adapated code. Will make it easier for
  this library to also be updated to Vue 3.
- Uses new watcher option since it was changed to be lazy by default
- now using shallow ref since xstate objects should not be refs deeply.
