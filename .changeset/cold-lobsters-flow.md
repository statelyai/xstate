---
'xstate': minor
---

The `tags` property was missing in `StateNode` prototype definition.

```ts
  public get definition(): StateNodeDefinition<TContext, TStateSchema, TEvent> {
    return {
      id: this.id,
      key: this.key,
      version: this.version,
      context: this.context,
      type: this.type,
      initial: this.initial,
      history: this.history,
      states: mapValues(
        this.states,
        (state: StateNode<TContext, any, TEvent>) => state.definition
      ) as StatesDefinition<TContext, TStateSchema, TEvent>,
      on: this.on,
      transitions: this.transitions,
      entry: this.onEntry,
      exit: this.onExit,
      activities: this.activities || [],
      meta: this.meta,
      order: this.order || -1,
      data: this.doneData,
      invoke: this.invoke,
      description: this.description,
      tags: this.tags //<- this was missing
    };
  }

  public toJSON() {
    return this.definition;
  }
```

When [`@xstate/inspect`](https://github.com/davidkpiano/xstate/tree/main/packages/xstate-inspect) internally calls its utility method

```ts
stringify(machine);
```

the resulting JSON has not the `tags` property defined.

As result, a machine visualized through [`xstate-viz`](https://github.com/statelyai/xstate-viz) has all its states's tags missing.
