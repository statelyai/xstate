---
'@xstate/svelte': patch
---

Fixed an issue with the internal interpreter created by `useMachine` being unsubscribed when its subscribers' count went to zero. The lifetime of this interpreter should be bound to the lifetime of the component that has created it.
