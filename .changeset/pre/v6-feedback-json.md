---
"xstate": patch
---

Make JSON machine loading reject unknown structural keys, string transitions, invalid initial states, unresolved nested guards, and cyclic guard definitions. Apply action lists sequentially, evaluate nested output expressions, and report precise evaluator paths. Restore runtime sources and support runtime schemas plus a validator when reviving machines. Copy loaded and serialized definitions so callers cannot mutate the machine. Accept payloads on raised JSON events.
