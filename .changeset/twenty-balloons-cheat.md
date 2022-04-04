---
'@xstate/react': patch
---

Implementations given to `useMachine` targeting `@xstate/fsm` are now updated in a layout effect. This avoid some stale closure problems for actions that are executed in response to events sent from layout effects.
