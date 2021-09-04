---
'@xstate/svelte': minor
---

Added new useSelector(actor, selector), which subscribes to actor and returns a svelte store that represents the selected state derived from selector(snapshot):

```svelte
<script>
  // It won't be updated unless the selected value changed.
  const value = useSelector(service, (state) => state.context.value);
</script>

<p>{$value}</p>
```
