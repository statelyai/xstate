---
'xstate': patch
---

Fixed an issue with external transitions targeting ancestor states. In such a case, `entry` actions were incorrectly called on the states between the source state and the target state for states that were not reentered within this transition.
