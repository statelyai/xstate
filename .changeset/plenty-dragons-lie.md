---
'xstate': major
---

`spawn` is no longer importable from `xstate`. Instead you get it in `assign` like this:

```js
assign((ctx, ev, { spawn }) => {
  return {
    ...ctx,
    actorRef: spawn(promiseActor)
  };
});
```

In addition to that, you can now `spawn` actors defined in your implementations object, in the same way that you were already able to do that with `invoke`. To do that just reference the defined actor like this:

```js
spawn('promiseActor');
```
