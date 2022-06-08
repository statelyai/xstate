# Usage with Deno

[Deno](https://deno.land/) is an alternate TypeScript/JavaScript runtime, similar to NodeJS, but has built-in TypeScript support and is not intantly compatable with most npm packages.

So to run XState on Deno, you need to import it differently, via [Skypack](https://www.skypack.dev/). Packages are 'installed' at runtime; no more `/node_modules`!

```js
import { createMachine } from 'https://cdn.skypack.dev/xstate';
```

You can see it [in action here](https://www.mycompiler.io/view/B8EgR64).
