---
'@xstate/inspect': patch
---

Fixed an issue that prevented some states from being sent correctly to the inspector when serializable values hold references to objects throwing on `toJSON` property access (like `obj.toJSON`). This property is accessed by the native algorithm before the value gets passed to the custom `serializer`. Because of a bug we couldn't correctly serialize such values even when a custom `serializer` was implemented that was meant to replace it in a custom way from within its parent's level.
