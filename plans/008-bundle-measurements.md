# Bundle capability measurements

Measured during audit remediation on 2026-09-07 after core correctness commit `6e8d66f8e0`, with the final dependency alignment and store/adapter fixes in the same worktree. No production runtime code changed for this experiment.

## Reproduce

```sh
node --test scripts/bundle-size-verify.test.mjs
node scripts/bundle-size.mjs --report --verify --json > /tmp/bundle-source.json
node scripts/bundle-size.mjs --report --verify --baseline=2c4eeb4881 --json > /tmp/bundle-baseline.json
node scripts/bundle-size.mjs --report --verify --experiment=lazy-bind --json > /tmp/bundle-lazy.json
node scripts/bundle-size.mjs --report --why --profile=machine-construction --json
pnpm build
node scripts/bundle-size.mjs --dist --report --verify --json > /tmp/bundle-dist.json
pnpm postinstall
```

The in-memory experiment defers the six constructor-bound StateMachine callbacks until first access, caching their bound values so destructured callbacks still have an instance receiver. Every representative profile passes, but this is not a claim of full public API equivalence: property descriptors and the point at which own properties appear change. It remains diagnostic tooling, never a production transform.

## Decision

Reject lazy binding. Construction-only gzip grows by 86 bytes with esbuild and 84 bytes with Terser; minimal machine grows by 84/86; pure machine grows by 85/87. Deferring method binding does not separate capabilities when an escaping class still exposes the complete transition, start, restoration and persistence surface. Getter/caching machinery adds cost. Custom actor, store and atom profiles are unaffected.

Current source gzip versus the original `2c4eeb4881` audit baseline: custom actor 6508 → 6747 (+239); construction 25554 → 25837 (+283); minimal machine 25575 → 25867 (+292); pure machine 25713 → 26011 (+298). These are the cost of the intervening correctness baseline, not a claimed optimization. The basic FSM remains 389 bytes. The original threshold budgets were already stale before these fixes; this change preserves them and adds CI behavioral verification plus informational artifacts instead of raising every budget.

Construction-only esbuild attribution still includes stateUtils (20,806 minified bytes), StateMachine (11,115), createActor (10,286), transitionActions (8,497), system (6,485), getNextSnapshot (2,137), and remoteActorRef (1,662). These are module-attributed minified bytes, not independently compressed download contributions. They demonstrate the retained engine/runtime coupling; they cannot predict additive savings from deleting a module.

## Bounded follow-up

Before any runtime capability split, prototype separating the inert actor scope used by pure snapshot computation from the live actor factory. Investigate the `_canTransition` and `getNextSnapshot` paths together, preserving spawned snapshot actor references, restoration, inspection, runtime overrides, and destructured public methods. Measure construction, pure transition, live actor, remote restoration, and durable behavior together. Only proceed with a measured size win plus those behavior regressions; do not create an alternative restricted StateMachine API under the existing factory name. The lazy-binding result alone does not establish that a larger split is safe or valuable.

## Verification scope

All 25 source profiles execute the actual esbuild and Terser artifacts with exact log assertions or factory export checks. Delays and invoked work are awaited through their final states. Persistence uses a changed state serialized through JSON; the combined machine/actor profile finishes its invoked work with a deterministic local input. React machine/store profiles render real hooks through server rendering; they exclude React and ReactDOM peers but include bundled compatibility helpers. Framework mount/replacement/cleanup correctness is covered separately by adapter tests. The verifier's negative regression rejects wrong output even with a zero process exit code.

Assertions live outside measured application artifacts. The reports record Node, esbuild, Terser, pako, lockfile SHA256, per-profile source hash, external imports, minified/gzip bytes and whether execution was verified. Fixed pako compression avoids Node zlib version variation. CI uploads both reports from the runner temporary directory so generated JSON cannot affect source formatting checks.

The same 25 profiles also pass against `2c4eeb4881` package source substituted with `git show`, using the current locked compilers/dependencies and package resolution. Store counter gzip is 2937 → 2975 (+38); atom 1689 → 1733 (+44); React machine 27334 → 27602 (+268); React store 3290 → 3316 (+26). These aggregate remediation deltas include correctness improvements; they do not isolate the contribution of a single comparator or notification change.

## Verified source and production build

Node v25.9.0; esbuild 0.25.4; Terser 5.49.0; pako 2.1.0. Lockfile SHA256: `e56edd3fee1b438e236bc2d3a239dc7408c29ddeb0179add01c5baf022c56608`. Both source and built results verified all 25 profiles with both minifiers after a successful production build. Built profiles resolve public package imports through temporary consumer node_modules links, with no direct entry aliases. This checks the ESM export-map path as well as artifact behavior; it does not test packed tarball contents or every CommonJS condition.

| Profile | Source gzip | Built gzip | Source Terser gzip | Built Terser gzip | Input hash |
| --- | ---: | ---: | ---: | ---: | --- |
| fsm-logic | 389 | 384 | 376 | 376 | 8f31b4bcb503be34 |
| fsm-entrypoint-logic | 389 | 384 | 376 | 376 | 67592f4ccfc4541b |
| minimal-machine | 25867 | 25905 | 24813 | 24879 | 3d795d4490e8d5e8 |
| minimal-fsm | 389 | 386 | 376 | 376 | 26135a4eb6eaa31f |
| fsm-setup | 483 | 479 | 384 | 384 | b838edd7f7b50c79 |
| custom-logic-actor | 6747 | 6942 | 6586 | 6624 | c2b8446eb8e5b91f |
| machine-construction | 25837 | 25886 | 24793 | 24856 | 2e78cb26491001ab |
| pure-machine | 26011 | 26035 | 24911 | 24975 | 0dbbb44bccd5d0d7 |
| compound | 25876 | 25914 | 24820 | 24885 | 319962d9d8c00849 |
| parallel | 25888 | 25925 | 24830 | 24896 | 707163269a2c9d8a |
| history | 25929 | 25970 | 24882 | 24947 | 4296c3a5a24edbda |
| final | 25884 | 25921 | 24832 | 24898 | d5c452452a1460d8 |
| eventless | 25876 | 25914 | 24819 | 24883 | 4a301698d30a4c83 |
| actionful | 25882 | 25922 | 24827 | 24892 | 8f166432b340d63e |
| invoked | 27158 | 27199 | 26110 | 26158 | e1a4a66d391fe9d1 |
| delayed | 25886 | 25923 | 24833 | 24898 | 7fdd6028eddc66fa |
| persisted | 25901 | 25937 | 24844 | 24910 | bbe0e35cf39eeabe |
| inspected | 25877 | 25915 | 24823 | 24887 | 7bd664829bce8b3e |
| machine-and-actors | 27211 | 27258 | 26165 | 26213 | 7d11238906cacc8e |
| validated-machine | 27611 | 27618 | 26457 | 26506 | 732811b80d3e2aed |
| store-counter | 2975 | 2869 | 2802 | 2742 | 5a0040e5de183879 |
| store-atom | 1733 | 1695 | 1587 | 1534 | 6d27f54dd53cbf97 |
| react-machine | 27602 | 27669 | 26297 | 26378 | 6acb3e102e50788d |
| react-store | 3316 | 3203 | 3111 | 3036 | 88131a1887146232 |
| kitchen-sink | 35547 | 35592 | 34131 | 34127 | d5acb39aa24261fb |

## Subsequent arbitrary-key and cleanup correctness follow-up

All25 source profiles still pass both minifiers after own-property journal reads, prototype-safe state names, and draining all cleanups after an error. Relative to the table above: custom-logic-actor 6747 → 6778 (+31 bytes); minimal-machine 25867 → 25943 (+76 bytes); invoked 27158 → 27269 (+111 bytes); store-counter 2975 → 2975 (+0 bytes). After the declaration-boundary repair and a fresh production build, all25 public-package distribution profiles pass both minifiers. Built gzip: custom actor 6972, minimal machine 25983, invoked 27302. The strict TypeScript consumer also passes with skipLibCheck disabled.

## Final dependency-resolved verification

Lockfile SHA256: `979bd60f07dd7cdf24673f6672363131e074e99ef9e648df36410787e7ab1c23`. Node v25.9.0; esbuild 0.25.4; Terser 5.49.0; pako 2.1.0. All 25 source and 25 public-package distribution profiles passed behavior assertions with both minifiers. Sizes below are gzip bytes. React is externalized in adapter profiles.

| Profile | Source esbuild | Built esbuild | Source Terser | Built Terser |
| --- | ---: | ---: | ---: | ---: |
| fsm-logic | 389 | 384 | 376 | 376 |
| fsm-entrypoint-logic | 389 | 384 | 376 | 376 |
| minimal-machine | 25943 | 25983 | 24871 | 24939 |
| minimal-fsm | 389 | 386 | 376 | 376 |
| fsm-setup | 483 | 479 | 384 | 384 |
| custom-logic-actor | 6778 | 6972 | 6612 | 6650 |
| machine-construction | 25913 | 25964 | 24851 | 24916 |
| pure-machine | 26082 | 26102 | 24969 | 25035 |
| compound | 25952 | 25992 | 24878 | 24945 |
| parallel | 25964 | 26004 | 24888 | 24957 |
| history | 26007 | 26046 | 24939 | 25008 |
| final | 25960 | 25999 | 24890 | 24958 |
| eventless | 25950 | 25992 | 24876 | 24943 |
| actionful | 25958 | 26000 | 24885 | 24952 |
| invoked | 27269 | 27302 | 26206 | 26255 |
| delayed | 25962 | 26001 | 24890 | 24958 |
| persisted | 25977 | 26015 | 24901 | 24969 |
| inspected | 25953 | 25993 | 24880 | 24947 |
| machine-and-actors | 27320 | 27360 | 26261 | 26311 |
| validated-machine | 27684 | 27689 | 26516 | 26568 |
| store-counter | 2975 | 2869 | 2802 | 2742 |
| store-atom | 1733 | 1695 | 1587 | 1534 |
| react-machine | 27673 | 27736 | 26364 | 26445 |
| react-store | 3316 | 3203 | 3111 | 3036 |
| kitchen-sink | 35658 | 35698 | 34230 | 34255 |
