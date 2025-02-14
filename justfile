[private]
default:
	@ just --list --unsorted

init:
	test -d node_modules || pnpm install

lint:
	pnpm lint

build:
	pnpm build

test:
	pnpm typecheck
	pnpm test

ci: init build lint test
	pnpm --filter @xstate/svelte svelte-check
	pnpm knip
	# ✅ PASSED
