---
'@xstate/react': major
---

`asEffect` and `asLayoutEffect` action creators were removed. They were not fitting the React model that well and could lead to issues as their existence suggested that they are easy to use.

To execute actions at those exact times you can always either just call your stuff directly from those effects or send events to the machine from those effects and execute explicit actions in response to said events.
