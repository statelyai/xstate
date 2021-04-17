---
'@xstate/react': patch
---

The `executeEffect` function is no longer exported (was meant to be internal and is useless as a public function anyway). This also fixes a circular dependency issue.
