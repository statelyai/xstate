---
title: Setup
description: ''
position: 2
category: Guide
---

Check the [Nuxt.js documentation](https://nuxtjs.org/guides/configuration-glossary/configuration-modules) for more information about installing and using modules in Nuxt.js.

## Installation

Add `@nuxtjs/xxx` dependency to your project:

<code-group>
  <code-block label="Yarn" active>

```bash
yarn add @nuxtjs/xxx
```

  </code-block>
  <code-block label="NPM">

```bash
npm install @nuxtjs/xxx
```

  </code-block>
</code-group>

Then, add `@nuxtjs/xxx` to the `modules` section of `nuxt.config.js`:

```js[nuxt.config.js]
{
  modules: [
    '@nuxtjs/xxx'
  ],
  xxx: {
    // Options
  }
}
```
