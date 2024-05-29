---
'@xstate/graph': major
---

pr: #4896
commit: 7c6e2ea

The `createTestMachine(…)` function has been removed. Use a normal `createMachine(…)` or `setup(…).createMachine(…)` function instead to create machines for path generation.
