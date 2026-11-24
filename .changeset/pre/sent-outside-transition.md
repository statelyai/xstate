---
'xstate': patch
---

With an inspector attached, events that an actor sends outside a transition, such as a callback actor's `sendBack` or an observable's values relayed to its parent, are no longer held in memory until that actor's next transition. They are also no longer listed in the `sent[]` of that later `@xstate.transition` event. `sent[]` lists only the events the transition itself sent. The receiving actor's `@xstate.transition` still reports each event with its `sourceRef`.
