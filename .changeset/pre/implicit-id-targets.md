---
'xstate': patch
---

`#` transition targets type-check against implicit state ids as well as explicit ones: `target: '#checkout.payment'`, or `'#shop.checkout.payment'` for a machine with `id: 'shop'`. Unknown ids are still type errors. At runtime, a `#` target can name a whole implicit id below a state with an explicit id, such as `'#wizard.step'` when `wizard` has `id: 'flow'`.
