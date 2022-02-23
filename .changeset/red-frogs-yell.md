---
'xstate': patch
---

Fixed an issue with context type defined using `schema.context` being sometimes widened based on `config.context`. If both are given the `schema.context` should always take precedence and should represent the complete type of the context.
