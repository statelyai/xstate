---
'@xstate/graph': major
---

The steps in the paths returned from functions like `getShortestPaths(...)` and `getSimplePaths(...)` have the following changes:

- The `step.event` property now represents the `event` object that resulted in the transition to the `step.state`, _not_ the event that comes before the next step.
- The `path.steps` array now includes the target `path.state` as the last step.
  - Note: this means that `path.steps` always has at least one step.
- The first `step` now has the `{ type: 'xstate.init' }` event
