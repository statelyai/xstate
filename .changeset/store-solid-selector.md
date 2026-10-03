---
'@xstate/store-solid': patch
---

`useSelector` now keeps the selected value current when its subscription starts, including updates made during component setup.
