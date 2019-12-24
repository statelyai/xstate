---
'@xstate/react': major
---

Drop `immediate` option from the `useMachine` hook. It wasn't safe for async React. If you need to send events to your created machine before it has a chance to start in React's commit phase for your component then you have to implement queuing of events appropriate for your use case.
