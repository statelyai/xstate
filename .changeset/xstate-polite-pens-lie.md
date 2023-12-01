---
'xstate': major
---

`State` class has been removed and replaced by `MachineSnapshot` object. They largely have the same properties and methods. On of the main noticeable results of this change is that you can no longer check `state instanceof State`.
