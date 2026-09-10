# PBT methodology and tool contract

**Ticket:** [PBT methodology and tool contract](https://github.com/Galz648/Retention/issues/35)
**Map:** [Invariants and property-based acceptance rails](https://github.com/Galz648/Retention/issues/34)
**Question:** Given bun:test, Effect, and existing `effect/FastCheck` usage in engine tests — what is the tool and methodology contract for invariant properties in this repo?

**Answer (one line):** Keep `import * as fc from "effect/FastCheck"` as the only PBT API; cite catalog ids in `test()` names; generate domain inputs at engine seams; leave CLI/TUI as example tests; husky pre-commit runs `bun run typecheck` then `bun test`, not compile or PTY.

---

## Method and limits

Claims follow the source that owns them: this repo's tests and lockfile; Effect 3.22.1 source and docs for the FastCheck re-export; Effect's v4 RC announcement for the planned drop of that re-export; fast-check.dev for runners, hybrid testing, and Bun wiring; bun.com for `bun:test` and `bun test`; typicode husky docs for bun-only hooks.

This note does not install husky, add `fast-check` to `package.json`, or write `specs/mechanics/INVARIANTS.md`. Generation here means PBT generators of inputs, not markdown-to-test codegen. Husky pre-commit is the lifecycle; there is no CI on this map.

---

## 1. What the repo already runs

`package.json` depends on `effect` `^3.22.1`. It does not list `fast-check`. Scripts are `test` → `bun test` and `typecheck` → `tsc --noEmit`. There is no husky hook, no `bunfig.toml`, and no mention of pre-commit or generated property tests in the tree today.

`bun.lock` records `effect@3.22.1` depending on `fast-check` `^3.23.1`, resolved to `fast-check@3.23.2`.

The only FastCheck imports are the three engine Live tests:

| File | Import | Runner |
|---|---|---|
| `src/engine/scheduler/live.test.ts` | `import * as fc from "effect/FastCheck"` | `await fc.assert(fc.asyncProperty(...))` |
| `src/engine/mastery/live.test.ts` | same | `fc.assert(fc.property(...), { numRuns: 80 })` |
| `src/engine/graph/live.test.ts` | same | `fc.assert(fc.property(...), { numRuns: 100 })` |

Those files also keep named example tests (exact `THRESHOLD`, isolated node, chain fixtures) next to the properties. `src/engine/no-cross-imports.test.ts` is a source scan, not a generator: it reads `src/engine/**/*.ts` and asserts mastery / graph / scheduler never import each other or store / corpus / session / cli.

Every other `*.test.ts` (cli, session, store, corpus, codec) imports only `bun:test`. CLI tests drive `handle` with a mute `CliIo` and fake Session / CorpusStore. Session tests compose Live layers over a fixture corpus and Memory store. Style tests pass explicit `{ stdoutTty, noColor }` records.

Architecture names the seam the engine tests already hit: mastery, graph, and scheduler are pure, standalone, and naive of each other; Session composes them; Session CLI is the impure frontend.

`tsconfig.json` `"include": ["src"]` and `"exclude": ["src/**/*.test.ts"]`. `bun run typecheck` therefore does not typecheck the property files. `bun test` still loads those files through Bun.

---

## 2. Tool: keep `effect/FastCheck`

Effect 3.22.1's `packages/effect/src/FastCheck.ts` is a full re-export:

```ts
export * from "fast-check"
```

Effect's Schema Arbitrary docs state that `Arbitrary.make` returns a fast-check `Arbitrary`, and that "the entirety of `fast-check`'s API is accessible via the `FastCheck` export." Engine tests already use that API (`string`, `double`, `uniqueArray`, `property`, `asyncProperty`, `assert`, `numRuns`).

fast-check's own docs: the library is test-runner agnostic; property-based tests live inside the host runner's `test` blocks. The Bun tutorial shows `import { describe, it, expect } from 'bun:test'` plus `import fc from 'fast-check'`, then `fc.assert(fc.property(...))` and `bun test`. Official fast-check setup for Bun is `bun install -D fast-check`. That is the same library Effect already depends on, not a second PBT stack.

**Three options, one recommendation.**

| Option | What it is | Verdict |
|---|---|---|
| Keep `effect/FastCheck` | Re-export of the locked `fast-check@3.23.2`. Matches the three Live tests. | **Keep.** Import path stays `effect/FastCheck`. |
| Add `fast-check` as a direct dependency | Pin the same package Effect already pulls. Official Bun tutorial does this. Not a second library. | Optional now. Required if the re-export disappears or we need a fast-check major Effect has not taken. Do not change the import path until that day. |
| A second library | jsverify, a custom generator stack, `@fast-check/jest`, vitest, fake-data instead of PBT. | **No.** Map already forbids a second PBT library without evidence. fast-check distinguishes fake-data and naive fuzzing from PBT (no shrinking, no edge-biased arbitraries). |

fast-check's hybrid-testing page: property-based tests complement example-based tests; they are not a substitute. That matches the engine files as they stand.

**Failure mode that would make us swap the import (not add a second library):** Effect v4. The Effect v4 RC announcement (31 Aug 2026) states: "Effect no longer re-exports `fast-check`, and the `Schema.toArbitrary` and `effect/testing/FastCheck` APIs were removed. Use `effect/unstable/arbitrary/Arbitrary.schema` for Schema-derived generation, or depend on `fast-check` directly for its other APIs." This repo is on Effect 3.22.1. When that upgrade lands, add `fast-check` as a direct dependency and change the three imports to `fast-check`. Until then, a second import path would be two names for one module.

Not a swap trigger: wanting Schema-derived generators on Effect 3 (`Arbitrary.make` already returns a fast-check `Arbitrary`). Not a swap trigger: bun:test lacking a built-in PBT API — bun:test is Jest-like (`describe` / `test` / `expect`); fast-check is the property runner and is documented to sit inside those blocks.

---

## 3. How a property cites a catalog id (no markdown compiler)

The catalog file is out of this ticket. Citation must work without compiling markdown into tests.

bun:test groups with `describe` and names cases with `test`. `bun test --test-name-pattern` / `-t` "run[s] only tests with a name that matches the given regex." Failures print those names. Comments do not appear in the runner and cannot be filtered.

fast-check has no catalog-id field. `fc.assert` reports seed, path, and counterexample. The human label is the bun:test name around the assert.

**Contract:** put the catalog id in the `test()` string, then a short claim. Optional: group related ids under `describe`. A comment may repeat the id next to the assert; it is not the citation. A helper that wraps `test` is unnecessary — bun:test already owns the name.

Example shape (ids are placeholders; harvest ticket owns wording):

```ts
describe("Scheduler.Live", () => {
  test("INV-SCHED-01: returns every sub-threshold card and only those cards", async () => {
    await fc.assert(fc.asyncProperty(classifiedArb, async (input) => { /* ... */ }))
  })
})
```

That is a naming convention, not a compiler. `bun test -t INV-SCHED-01` selects the property. The later `INVARIANTS.md` entry is the prose; the test is the executable check.

---

## 4. Engine-seam properties vs CLI/TUI properties

fast-check's own split: example-based tests hardcode inputs and outputs (including "what we expect to see on the screen" for end-to-end); properties quantify over generated inputs and state an invariant. It recommends a hybrid: keep examples; add properties where the claim is "for all."

**Engine seam — generators belong here.**

Scheduler / mastery / graph Live tests already do this. They build `fc.Arbitrary` values of domain types (`CardId`, `Brightness`, event logs, small graphs), provide the `Live` layer, and assert a quantified claim (due set equals sub-threshold ids; every card has one `Brightness` in `[0, 1]`; eligible never includes a node whose prerequisite is below `THRESHOLD`). Call the Tag, not the CLI.

Keep example tests beside them for named spec edges a shrinker should be able to rediscover but a reader should see in plain text: exact `THRESHOLD`, archived corpus, dangling edges, isolated node.

Construction invariants (no cross-imports, no `Date.now` / `Clock` in Live source) are source scans. They are not FastCheck properties. Do not generate TypeScript source.

**CLI / TUI — examples belong here.**

CLI tests already fix argv, mute IO, and fake Session. Claims are about labels, consent, ANSI, and "do not import engine." Those are specific screens and flags, not a large input space of domain values. Generating random help strings or random ANSI is not an invariant.

Session tests already compose the three Live layers over one fixture. A later property may generate corpora and event logs and assert Session.queue / grade through that seam. That is still an engine-shaped input space, not a TTY.

**What does not belong in generators**

- Compiled-binary PTY key sequences (alternate screen, j/k, q). `GAPS.md` lists those as a real-run checklist after `bun run compile`, not as `bun:test` cases. bun:test has no PTY API.
- `bun build --compile` itself.
- Store process spawn (`jsonl.ts` / corpus `bun.spawn`) as a FastCheck arbitrary.

If a CLI claim is truly quantified (every impure command refuses when `interactive: false`), `test.each` over the command table is enough. Promote to `fc.property` only if the input space is large and shrinking would help. That has not appeared in the current CLI tests.

---

## 5. What husky pre-commit can reasonably run

Husky's get-started page supports this repo's package manager: `bun add --dev husky`, `bunx husky init`, `prepare` script. How-to shows a bun-only hook:

```
# .husky/pre-commit
bun test
```

Hooks are POSIX shell. Multiple commands are just sequential lines; a non-zero exit aborts the commit. Skip hatches husky documents: `git commit -n`, `HUSKY=0`. Solo developer, no CI — the CI/`HUSKY=0` install dance is irrelevant here.

`package.json` already has the two scripts the map named: `typecheck` and `test`.

**Reasonable on every commit**

```
bun run typecheck
bun test
```

That is `tsc --noEmit` plus the existing suite, including the three FastCheck Live files. fast-check is runner-agnostic and already runs under `bun test`. No second command is required to "turn on" PBT.

**Not reasonable on every commit: compiled-binary PTY**

- Compile is a separate script (`bun build --compile --outfile retention src/cli/main.ts`). It writes an artifact. Husky does not document compile-or-PTY as a hook kind; the hook is whatever shell you put in `.husky/pre-commit`.
- bun:test default per-test timeout is 5000 ms (`bun test --timeout`, also the third argument to `test`). A compile plus an interactive PTY session is a different budget than `fc.assert` with `numRuns` 80–100 over in-memory maps.
- Repo verification of TTY feel is written as a manual checklist in `GAPS.md` ("TTY (PTY or `script`): `./retention` after `bun run compile`…"), not as a test file.
- Map already flagged compiled-binary PTY as "likely too heavy." Official sources give no cheaper first-party substitute.

Do not put `bun run compile` or a PTY driver on pre-commit. If a later spec wants a compiled-binary check, it is a rare manual command, not the lifecycle hook.

**Timeout contract if properties grow**

fast-check's `timeout` applies per async predicate; `interruptAfterTimeLimit` caps the whole `assert`. bun:test's timeout caps the `test()` that wraps `assert`. A property that needs more than 5 s must raise the bun:test timeout (third argument or `bun test --timeout`). Do not silently drop `numRuns` to fit a hook. Current engine `numRuns` (80 / 100) are already explicit local `Parameters` — that is the fast-check-documented way to override.

---

## 6. Contract (for later spec drafts)

1. **One PBT library.** `effect/FastCheck` on Effect 3. Same `fast-check` that `bun.lock` already has. No second generator stack.
2. **One runner.** `bun:test` `describe` / `test` / `expect`. `fc.assert` inside the test. `fc.property` for sync Live calls; `fc.asyncProperty` when the seam is already `Effect.runPromise` (scheduler today).
3. **Citation.** Catalog id in the `test()` name. No markdown-to-test compiler.
4. **Generators** produce domain inputs at a seam (engine Tag+Live; later Session if the claim is still about cards / events / corpora). **Examples** name spec edges and all CLI/TUI/PTY/source-scan checks.
5. **Lifecycle.** husky `pre-commit` → `bun run typecheck` && `bun test`. Not CI. Not compile. Not PTY.
6. **Swap.** Move the import to direct `fast-check` when Effect stops re-exporting it (v4 RC already says this), or when we need a fast-check major Effect has not taken. That is a dependency pin, not a methodology change.

---

## Sources

### This repo

- `package.json` (scripts, `effect` dependency, no `fast-check`, no husky)
- `bun.lock` (`effect@3.22.1` → `fast-check@3.23.2`)
- `tsconfig.json` (`exclude`: `src/**/*.test.ts`)
- `src/engine/scheduler/live.test.ts`
- `src/engine/mastery/live.test.ts`
- `src/engine/graph/live.test.ts`
- `src/engine/no-cross-imports.test.ts`
- `src/engine/scheduler/interface.ts`
- `src/cli/handle.test.ts`, `src/cli/style.test.ts`
- `src/session/live.test.ts`
- `specs/mechanics/ARCHITECTURE.md`, `specs/mechanics/components/ENGINE.md`
- `specs/mechanics/GAPS.md` (compiled-binary TTY checklist)

### Effect

- FastCheck re-export, tag `effect@3.22.1`: https://github.com/Effect-TS/effect/blob/effect@3.22.1/packages/effect/src/FastCheck.ts
- `packages/effect/package.json` `fast-check` `^3.23.1`: https://github.com/Effect-TS/effect/blob/effect@3.22.1/packages/effect/package.json
- Schema to Arbitrary (v3): https://effect.website/docs/schema/arbitrary/
- Effect v4 RC, 31 Aug 2026 (re-export removed): https://www.effect.website/blog/effect-v4-rc-august-recap

### fast-check

- Home (runner-agnostic): https://fast-check.dev/
- Quick Start: https://fast-check.dev/docs/tutorials/quick-start/
- Bun test runner tutorial: https://fast-check.dev/docs/tutorials/setting-up-your-test-environment/property-based-testing-with-bun-test-runner/
- Runners (`assert`, `check`, `sample`): https://fast-check.dev/docs/core-blocks/runners/
- Configuration (per-assert `Parameters` vs `configureGlobal`): https://fast-check.dev/docs/configuration/
- Timeouts (`timeout`, `interruptAfterTimeLimit`): https://fast-check.dev/docs/configuration/timeouts/
- Why property-based (example vs property, hybrid, not a second runner): https://fast-check.dev/docs/introduction/why-property-based/

### bun:test

- Writing tests (`describe`, `test`, default 5000 ms timeout): https://bun.com/docs/test/writing-tests
- `bun test` CLI (`--timeout`, `-t` / `--test-name-pattern`): https://bun.com/docs/cli/test
- Test configuration (`bunfig.toml`): https://bun.com/docs/test/configuration

### husky

- Home: https://typicode.github.io/husky/
- Get started (`bun add --dev husky`, `bunx husky init`): https://typicode.github.io/husky/get-started.html
- How to (`bun test` in `.husky/pre-commit`, `prepare`, `HUSKY=0`, `git commit -n`): https://typicode.github.io/husky/how-to.html
