---
'@xstate/graph': patch
'@xstate/test': patch
---

author: @davidkpiano
pr: #3864
commit: 59f3a8e

Event cases are now specified as an array of event objects, instead of an object with event types as keys and event object payloads as values:

```diff
const shortestPaths = getShortestPaths(someMachine, {
- eventCases: {
-   click: [{ x: 10, y: 10 }, { x: 20, y: 20 }]
- }
+ events: [
+   { type: 'click', x: 10, y: 10 },
+   { type: 'click', x: 20, y: 20 }
+ ]
});
```
