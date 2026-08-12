---
title: Contributing documentation
description: Write and validate documentation in this repository.
---

Documentation lives next to the package or concept it describes.

- Put XState guides and reference pages in `docs/`.
- Put framework and package pages in that package's `docs/` directory.
- Add every page to the nearest `meta.json`.

## Write for the reader

Start with working code. Explain the behavior the reader can observe. Introduce one concept at a time.

Use short sentences and concrete names. Prefer `loading`, `ready` and `failed` over abstract state names. Explain why a feature is useful before listing its options.

## Examples

Use TypeScript unless JavaScript behavior is the subject. Keep examples complete enough to copy and run. Verify examples against the current package source and types.

Add a `TypeScript` section when readers need schemas, inference or type helpers. Add a cheatsheet to reference pages with several related forms.

## Validate changes

- Check local links and navigation files.
- Format Markdown and JSON.
- Run focused type checks or tests for changed examples.
- Check that commands use the current package version.
