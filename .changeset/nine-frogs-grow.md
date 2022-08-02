---
'xstate': minor
---

A new [`predictableActionArguments`](https://xstate.js.org/docs/guides/actions.html) feature flag has been added that allows you to opt into some fixed behaviors that will be the default in v5. With this flag:

- XState will always call an action with the event directly responsible for the related transition,
- you also automatically opt-into [`preserveActionOrder`](https://xstate.js.org/docs/guides/context.html#action-order).

Please be aware that you might not able to use `state` from the `meta` argument when using this flag.
