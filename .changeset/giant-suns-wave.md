---
'xstate': patch
---

Fixed compatibility with esoteric [Mini Program](https://developers.weixin.qq.com/miniprogram/en/dev/framework/app-service/) environment where `global` object was available but `global.console` wasn't.
