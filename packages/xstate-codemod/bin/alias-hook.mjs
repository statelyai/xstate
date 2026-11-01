// Maps `xstate` and `xstate/*` to the major selected by XSTATE_VERIFY_MAJOR:
// `xstate5` (npm:xstate@5, bundled with this package) or this package's own
// `xstate` (6). Under 6, `xstate-v6` (the side-by-side install name from the
// migration guide) maps to the same package. Synchronous hooks cover both
// `import` and `require` (tsx transpiles CommonJS user files). Every specifier
// resolves from this file, so the user's module and the verify runner share
// one xstate instance.
import { registerHooks } from 'node:module';

const major = process.env.XSTATE_VERIFY_MAJOR;
if (major !== '5' && major !== '6') {
  throw new Error(`XSTATE_VERIFY_MAJOR must be 5 or 6, got ${major}`);
}
const target = major === '5' ? 'xstate5' : 'xstate';
const aliases = major === '5' ? ['xstate'] : ['xstate', 'xstate-v6'];
let resolvingTarget = false;

function aliasFor(specifier) {
  return aliases.find(
    (alias) => specifier === alias || specifier.startsWith(`${alias}/`)
  );
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = resolvingTarget ? undefined : aliasFor(specifier);
    if (alias) {
      resolvingTarget = true;
      try {
        const url = import.meta.resolve(target + specifier.slice(alias.length));
        return { url, shortCircuit: true };
      } finally {
        resolvingTarget = false;
      }
    }
    return nextResolve(specifier, context);
  }
});
