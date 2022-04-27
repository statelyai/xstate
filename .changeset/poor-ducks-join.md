---
"@xstate/inspect": minor
---

`@xstate/inspect` will now target `https://stately.ai/viz` by default. You can target the old inspector by setting the config options like so:

```ts
inspect({
  url: `https://statecharts.io/inspect`,
});
```
