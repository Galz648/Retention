# Candidate invariants from specs and tests

Research for [issue 37](https://github.com/Galz648/Retention/issues/37), under [Invariants and property-based acceptance rails](https://github.com/Galz648/Retention/issues/34). No catalog file, no properties, no product-policy invention.

**Question:** which standing invariants can be harvested from existing specs and tests — including **construction** invariants for how a new module is built — without inventing new product policy?

**Sources in scope (ticket):** `specs/mechanics/KEY_DECISIONS.md`, `SCOPE.md`, `TRADEOFFS.md`, `components/ENGINE.md`, `SESSION.md`, `SESSION_CLI.md`, `src/engine/no-cross-imports.test.ts`, existing `effect/FastCheck` properties in `src/engine/*/live.test.ts`, `CONTEXT.md`. Adjacent tests that already encode those same claims are cited as encoding, not as new law. Product specs still say **component** for Engine / Session / Session CLI. Construction talk uses codebase-design: **module**, **interface**, **seam**, **adapter**.

---

## Verdict (read this first)

The repo already has a standing law. It is split across locked product prose (`KEY_DECISIONS.md`, Session / Session CLI / Engine component specs, `CONTEXT.md`) and a smaller set of executable checks (engine isolation scans, three `effect/FastCheck` suites, Session example tests, Session CLI example tests, store read-empty).

Harvest **behavior** (true of any run) and **construction** (true of how a module is built). Do not promote placeholders (the name Brightness, the numeric `THRESHOLD`, FSRS `w` sets, Session's node-fold TODO) or parked features (Forester, calibrator, capture, curation, `--yes` as a future flag, env-var config as a future interface, one-card review loop).

Recommend catalog ids `INV-{B|C}-{owner}-{nn}`. Each later property cites one id. Owners are the product component or seam the claim binds to. FastCheck already exists only at the three Engine Tag seams; Session, Session CLI, and Store still use example tests. A new module should ship properties for the ids that apply at **its** seam — that itself is a construction candidate, taken from [issue 34](https://github.com/Galz648/Retention/issues/34) plus the existing Engine pattern, not a new product rule.

---

## Catalog id scheme

```
INV-{kind}-{owner}-{nn}
```

| Piece | Values | Meaning |
| --- | --- | --- |
| `kind` | `B` | **Behavior** — true of any run, at a seam |
| `kind` | `C` | **Construction** — true of how a module / adapter is built |
| `owner` | `LANG` | User-facing language (`CONTEXT.md`) |
| `owner` | `CLI` | Session CLI component |
| `owner` | `SES` | Session component |
| `owner` | `ENG` | Engine as a whole (isolation across Tags) |
| `owner` | `MST` | Mastery Tag |
| `owner` | `GRF` | Graph Tag |
| `owner` | `SCH` | Scheduler Tag |
| `owner` | `STO` | Store module (opaque append-only log) |
| `owner` | `MOD` | Any new module (meta construction) |
| `nn` | `01`… | Stable within owner + kind. Do not reuse. |

Rules for later `specs/mechanics/INVARIANTS.md` (not written here):

- One claim per id. A property cites the id; the id does not cite the property.
- Owner is the seam that must uphold the claim, not the file that first mentioned it.
- Do not put placeholder names or numeric knobs in the id (`BRIGHTNESS`, `W`, `0.9`).
- Parked product does not get an id on this version's catalog.
- `KEY_DECISIONS.md` stays the product lock. The catalog is the executable standing law.

Encoding column below:

- **property** — already an `effect/FastCheck` property
- **example** — bun example / source-scan test, not a generator
- **prose** — locked in spec, no test yet

---

## Not harvested (placeholders and parked)

These appear in the same files. They are **not** candidates.

| Item | Why it is not an invariant | Source |
| --- | --- | --- |
| Name "Brightness" | Placeholder name until evidence | `KEY_DECISIONS.md`; `CONTEXT.md` |
| Numeric `THRESHOLD` (`0.9` in `src/config.ts`) | Threshold stays a placeholder until evidence. The **compare relations** are harvested; the number is not. | `KEY_DECISIONS.md`; scheduler Live even forbids a `0.9` literal (`src/engine/scheduler/live.test.ts`) |
| FSRS `w` sets / due dates / intervals | Mastery uses FSRS internally and discards next-due-date. Specific weights are not product law. Intervals stay inside mastery. | `components/MASTERY.md`; `CONTEXT.md` (avoid list); `src/engine/mastery/interface.ts` |
| Session node Brightness fold (min of cards) | Explicit TODO / placeholder — not a claim about how a concept is known | `src/session/live.ts` |
| `--yes` as a future flag | Parked. **This version has no `--yes`** is harvested as construction. Adding the flag is not. | `SCOPE.md`; `SESSION_CLI.md` Does not (parked); `KEY_DECISIONS.md` |
| Env-var configuration as the interface | Parked as a future interface. **This version has no user-facing env-var interface** is harvested. `NO_COLOR` is feel, not tree/log selection. | `SCOPE.md`; `KEY_DECISIONS.md`; `SESSION_CLI.md` |
| Forester, capture, curation, calibrator, dormancy | Do not build this version | `SCOPE.md` |
| One-card interactive review loop | Parked | `SESSION_CLI.md` Does not (parked) |
| Practice cards, Grader | Parked | `LEGEND.md` (adjacent; not in ticket list) |
| Tag-level `--trace`, structured trace | Parked | `OBSERVABILITY.md` (adjacent) |
| TypeScript vs Rust client | Allowed, not chosen | `KEY_DECISIONS.md`; `TRADEOFFS.md` |
| Session-level events for a calibrator | Open, not decided | `GAPS.md` (adjacent) |
| Isolated `mastery` / `graph` / `scheduler` **command list in this checkout's help** | Spec-locked in `KEY_DECISIONS.md`; `src/cli/handle.ts` `helpText` does not yet list them. Harvest the isolation rule; do not treat today's help list as the law. | `KEY_DECISIONS.md`; `src/cli/handle.ts` |

`SPEC.md` is older framing. Where it conflicts with `KEY_DECISIONS.md` (for example a scheduler that folds the log and emits intervals), `KEY_DECISIONS.md` wins. Not used as a harvest source.

---

## Behavior candidates

True of any run. Product components keep their spec names.

### User-facing language

| Id | Claim | Source | Encoding |
| --- | --- | --- | --- |
| **INV-B-LANG-01** | The person sees **titles**, prompts, and glossary words. They do not see folder names, card ids, or file formats. | `CONTEXT.md`; `KEY_DECISIONS.md`; `TRADEOFFS.md`; `SESSION_CLI.md` | **example** — `src/cli/handle.test.ts` (trees/queue/tree/completions omit `biology-ii` and card ids); `src/cli/trees-view.test.ts`; `src/cli/titles.test.ts` (match by title / unique prefix) |

### Session CLI — interface of a run

| Id | Claim | Source | Encoding |
| --- | --- | --- | --- |
| **INV-B-CLI-01** | The command-line program is the only client. The user does not set environment variables to choose a tree or open corpus/log files to use the system. Paths are owned by the program. | `KEY_DECISIONS.md`; `SCOPE.md`; `TRADEOFFS.md`; `SESSION_CLI.md` | **prose**. `src/cli/main.ts` hard-codes `corpus` and `data/log.jsonl` and reads only `NO_COLOR`. No test forbids a `RETENTION_*` tree/log interface. |
| **INV-B-CLI-02** | Commands are labeled **pure** (no create/append/move/delete) or **impure** (any write). Help (and no-args help text) marks each command `[pure]` / `[impure]` with a one-line description. Impure entries note that they ask first. | `KEY_DECISIONS.md`; `SESSION_CLI.md`; `SCOPE.md` | **example** — `src/cli/handle.test.ts` "no args and help print labeled commands" |
| **INV-B-CLI-03** | Impure commands state what will happen, then ask. Default is no. Only `y` / `yes` (case-insensitive) continue. Anything else aborts with no write. Grade consent names the prompt, the rating, that this appends one review, and that a missing log **will create it**. | `KEY_DECISIONS.md`; `SESSION_CLI.md`; `TRADEOFFS.md` | **example** — `src/cli/handle.test.ts` "grade no does not write; grade yes does" |
| **INV-B-CLI-04** | If the program cannot ask yes/no (piped / non-interactive), an impure command **refuses** rather than writing. | `KEY_DECISIONS.md`; `SESSION_CLI.md`; `TRADEOFFS.md` | **example** — `src/cli/handle.test.ts` "grade without an interactive terminal refuses and does not write" |
| **INV-B-CLI-05** | Missing log = empty history. Pure commands do not create the log or its directory. Creating the log is a side effect. `queue` on a missing log must not create anything. | `SESSION_CLI.md`; `SESSION.md`; `KEY_DECISIONS.md` | **partial**. Store read of a missing file is **example** (`src/store/jsonl.test.ts`, `src/store/memory.test.ts`). No Session / Session CLI test that `queue` leaves the filesystem untouched. |
| **INV-B-CLI-06** | Each invocation chooses a tree (title argument, unique prefix, or picker). A run is not glued to one tree from startup. Tree choice is not held across process invocations. | `KEY_DECISIONS.md`; `SESSION_CLI.md`; `src/session/interface.ts` (each call names the tree) | **prose**. Title matching is **example** (`src/cli/titles.test.ts`). No test that a second process starts unglued. |
| **INV-B-CLI-07** | Numbers on `queue` / `show` / `grade` refer to the current queue for that tree, not to internal card ids. | `SESSION_CLI.md` | **example** — `src/cli/handle.test.ts` queue line uses `1.` and omits `der-diffusion` |
| **INV-B-CLI-08** | `queue` prints type, node title, prompt — no answers, no card ids. `show` prints the answer (recall) or must-hits (derivation). | `SESSION_CLI.md`; `TRADEOFFS.md` | **example** — `src/cli/handle.test.ts` |
| **INV-B-CLI-09** | Piped / non-TTY output is plain text: no color, no banner. Banner only on `help` (and the no-args help surface). Honor `NO_COLOR`. | `KEY_DECISIONS.md`; `SESSION_CLI.md` | **example** — `src/cli/handle.test.ts` (help without ANSI; banner never on queue); `src/cli/style.test.ts` (`NO_COLOR` or non-tty disables color) |
| **INV-B-CLI-10** | Unknown command: print help, exit non-zero. When a listed command runs, the first line restates the description in context, then the payload. `completions` is the exception: stdout is the script only. | `SESSION_CLI.md`; `GAPS.md` (completions exception; adjacent) | **partial**. Completions-script-only is **example** (`src/cli/handle.test.ts`). Context line on `queue` is **example**. Unknown-command exit is **prose** (implemented in `handle.ts`, no dedicated test). |
| **INV-B-CLI-11** | `trees` is a short list by kind: **title** + one sentence. Not node/card/edge counts. Not folder names. Not importer leftovers as the title the person sees. | `SESSION_CLI.md`; `TRADEOFFS.md`; `KEY_DECISIONS.md` | **example** — `src/cli/handle.test.ts`; `src/cli/trees-view.test.ts` |

`KEY_DECISIONS.md` also locks TTY default as the Session TUI (options menu; `q` leaves; no `tree` dump command; where you are in a map is the TUI path). That is standing product law for this version, still remaining work. **Do not** turn GAPS TUI keybindings into catalog ids until the later spec pass copies them from the locked feel text. Encoding today: **prose**.

### Session

| Id | Claim | Source | Encoding |
| --- | --- | --- | --- |
| **INV-B-SES-01** | Consent is in the program (Session CLI), not in Session. `Session.grade` does not prompt. | `KEY_DECISIONS.md`; `SESSION.md` | **prose**. Tests call `grade` with no prompt adapter. No source-scan that Session Live lacks `prompt` / `ask`. |
| **INV-B-SES-02** | `queue` is read-only. Missing log = empty history, no file created. Session does not create nodes. | `SESSION.md` | **prose** at this seam. Store missing-file empty is **example** (see INV-B-CLI-05 / INV-B-STO-01). |
| **INV-B-SES-03** | `grade` appends exactly one `CardReviewed` and nothing else. Unknown card is not written. | `SESSION.md`; `src/session/interface.ts` | **example** — `src/session/live.test.ts` |
| **INV-B-SES-04** | Session composes the engine: due ∩ eligible. It does not decide due-ness, compute mastery, or walk prerequisites itself. Queue presentation is recall then derivation. | `SESSION.md`; `SESSION_CLI.md` (`queue`); `src/session/interface.ts` | **partial**. Prerequisite blocking is **example** (`src/session/live.test.ts`). Recall-before-derivation is implemented (`src/session/live.ts` `byPresentation`) and specified; not a FastCheck property. |

### Engine Tag behavior (relations, not knobs)

The name of the `[0, 1]` number is a placeholder. The **relations** are locked.

| Id | Claim | Source | Encoding |
| --- | --- | --- | --- |
| **INV-B-MST-01** | Mastery emits one number per **input** card, in `[0, 1]`. Reviews for unknown card ids are ignored (no extra keys). | `CONTEXT.md` (range); `components/MASTERY.md`; `src/engine/mastery/interface.ts` | **property** — `src/engine/mastery/live.test.ts` "random logs: determinism, coverage, bounds…"; also example tests for coverage / ghost reviews |
| **INV-B-MST-02** | Same events, cards, and Clock → identical map. | `components/MASTERY.md` (pure); `src/engine/mastery/interface.ts` | **property** — same FastCheck block; also example "evaluate twice…" |
| **INV-B-MST-03** | Between two times with no review for that card in the open-closed window `(t1, t2]`, the number does not increase. | `components/MASTERY.md` (fades); encoded by tests | **property** — monotonic decay FastCheck; also example monotonic test |
| **INV-B-MST-04** | After the same history, recall fades faster than derivation. Card type affects the curve **inside mastery only**. | `components/MASTERY.md` | **example** — `src/engine/mastery/live.test.ts` "recall decays faster…". Not a FastCheck property. Specific rates / FSRS `w` are **not** this claim. |
| **INV-B-GRF-01** | A node is never eligible while a **valid** prerequisite is below the threshold. Missing snapshot treats a prerequisite as 0. | `components/GRAPH.md`; `src/engine/graph/interface.ts` | **property** — `src/engine/graph/live.test.ts`; example chain tests |
| **INV-B-GRF-02** | An archived corpus yields no eligible nodes. | `src/engine/graph/interface.ts` | **property** |
| **INV-B-GRF-03** | Edges whose endpoints are missing from the node set are ignored, not treated as prerequisites. Isolated / no-valid-prereq nodes are eligible. | `src/engine/graph/interface.ts` | **property** + example |
| **INV-B-GRF-04** | Same corpus + snapshot → identical output. Eligible ids are sorted and drawn only from corpus nodes. Node order in the corpus does not change the result. | `components/ENGINE.md` (pure); tests | **property** |
| **INV-B-SCH-01** | Due iff the number is **strictly below** the threshold. At-threshold is not due. Scheduler does not know dependencies, card types, or the time. | `components/SCHEDULER.md`; `src/engine/scheduler/interface.ts`; `KEY_DECISIONS.md` (threshold is a placeholder **value**, not a missing relation) | **property** — `src/engine/scheduler/live.test.ts` |
| **INV-B-SCH-02** | Same map always yields the same ids, in sorted `CardId` order, independent of insertion order. | `src/engine/scheduler/interface.ts` | **property** |

Graph and scheduler **import** `THRESHOLD` from `src/config.ts`. That import is construction (`INV-C-SCH-01`). The numeric value is not a behavior id.

### Store

| Id | Claim | Source | Encoding |
| --- | --- | --- | --- |
| **INV-B-STO-01** | The store appends and reads **records**. It does not interpret them. A missing file is empty history, not an error. | `CONTEXT.md` (Record / Store); `SESSION.md` / `SESSION_CLI.md` (missing log) | **example** — `src/store/jsonl.test.ts` "missing file is empty history"; `src/store/memory.test.ts` "appends opaque records… never parses them" |

---

## Construction candidates

True of how a module is built: what its adapter may import, provide, or expose at the seam.

### Engine isolation

| Id | Claim | Source | Encoding |
| --- | --- | --- | --- |
| **INV-C-ENG-01** | Mastery, graph, and scheduler never import each other. Each Engine Tag is standalone and naive of the others' existence. | `components/ENGINE.md`; `KEY_DECISIONS.md` (isolated engine commands); Tag interfaces | **example** — `src/engine/no-cross-imports.test.ts` |
| **INV-C-ENG-02** | Engine source does not import store, corpus I/O, session, or cli. Pure logic, no I/O. | `components/ENGINE.md` | **example** — `src/engine/no-cross-imports.test.ts` |
| **INV-C-MST-01** | Mastery Live never provides a Clock. It lists Clock in `R`. It does not call `Date.now` or `Clock.currentTimeMillis`. | `SESSION.md` (CLI supplies Clock); `src/engine/mastery/interface.ts` | **example** — `src/engine/no-cross-imports.test.ts` (no Clock provide); `src/engine/mastery/live.test.ts` (no `Date.now` / `Clock.currentTimeMillis`) |
| **INV-C-GRF-01** | Graph Live does not import Clock. Graph does not know the time. | `components/GRAPH.md`; `src/engine/graph/interface.ts` | **example** — `src/engine/graph/live.test.ts` |
| **INV-C-SCH-01** | Scheduler Live is blind to card type, edges, and Clock. It imports `THRESHOLD` from `src/config.ts`; it does not embed a magic literal. | `components/SCHEDULER.md`; `src/engine/scheduler/interface.ts` | **example** — `src/engine/scheduler/live.test.ts` "Live source is blind…" (also forbids `0.9`) |

### Session and Session CLI

| Id | Claim | Source | Encoding |
| --- | --- | --- | --- |
| **INV-C-SES-01** | Session does not compute the `[0, 1]` number or the threshold compare. It does not construct or `Layer.provide` a Clock — the caller (Session CLI or a test) supplies Clock and confirmation. | `SESSION.md`; `src/session/interface.ts` | **example** — `src/session/live.test.ts` "session live does not compute Brightness or THRESHOLD" (source scan: no `THRESHOLD`, `Date.now`, `Clock.make`, `ClockAt`) |
| **INV-C-CLI-01** | Session CLI does not compute the `[0, 1]` number, decide due-ness, walk prerequisites, or create nodes. CLI sources do not import engine Tags or `THRESHOLD`. | `KEY_DECISIONS.md`; `SESSION_CLI.md` | **example** — `src/cli/handle.test.ts` "CLI sources do not import engine components" |
| **INV-C-CLI-02** | There is no `--yes` in this version. Non-interactive writes are refused, not overridden by a flag. | `KEY_DECISIONS.md`; `SCOPE.md`; `SESSION_CLI.md`; `TRADEOFFS.md` | **prose**. `src/cli` has no `--yes` token. No test that greps the flag away. |
| **INV-C-CLI-03** | Isolated engine commands (`mastery`, `graph`, `scheduler`): each talks to **one** engine Tag. The CLI module may load corpus or log; it must not import the other two engines. Session CLI still does not compute the `[0, 1]` number itself. | `KEY_DECISIONS.md` | **prose** for the three commands (not in this checkout's `helpText`). The "do not import engine Tags" half is already **example** under INV-C-CLI-01. |
| **INV-C-CLI-04** | The program is named `retention`. TypeScript does not emit a binary; this version's artifact is Bun compile → one standalone program. `bun src/cli/main.ts` is a developer stand-in, not the product. | `KEY_DECISIONS.md`; `SCOPE.md`; `TRADEOFFS.md`; `SESSION_CLI.md` Binary | **partial**. Completions script starts `#compdef retention` (**example**). Binary production is **prose**. |
| **INV-C-CLI-05** | Client language (Bun TypeScript vs Rust) is not a construction invariant. Engine stays TypeScript. A later Rust client would still speak the same commands and consent rules and would not reimplement mastery / graph / scheduler. | `KEY_DECISIONS.md`; `TRADEOFFS.md`; `SESSION_CLI.md` Client language (open) | **prose** — constraint on a hypothetical adapter, not a must-build. Do not catalog "must be Rust" or "must stay Bun". |

### Store / codec (already encoded; backs CONTEXT, not new policy)

| Id | Claim | Source | Encoding |
| --- | --- | --- | --- |
| **INV-C-STO-01** | The store adapter owns bytes and framing. It returns opaque records. Interpretation (event types, derived due / interval / the `[0, 1]` number) sits above the store. Encoded review payloads do not carry `due`, `interval`, or `brightness`. | `CONTEXT.md` (Store / Event / avoid list); `src/store/interface.ts`; codec test | **example** — `src/store/memory.test.ts`; `src/codec/layers.test.ts` "payload has no derived fields" |

### Any new module

| Id | Claim | Source | Encoding |
| --- | --- | --- | --- |
| **INV-C-MOD-01** | A new module ships properties for the catalog ids that apply at **its** seam. Generation means generators of inputs (`effect/FastCheck`, already used at the Engine Tags). Do not pick a second PBT library without evidence. The interface is the test surface. | [Issue 34](https://github.com/Galz648/Retention/issues/34) Notes; existing `src/engine/*/live.test.ts`; codebase-design vocabulary in that map | **prose** (meta). Pattern exists at MST / GRF / SCH only. |
| **INV-C-MOD-02** | Adaptive parameters are learned, not configured. Anything that should fit a person is not a config field or a hand-set constant on a new module. The calibrator is **not** built; do not add the knobs it would replace. Clients keep only fixed preferences in config and record what happened. | `KEY_DECISIONS.md` | **prose**. Do not promote a calibrator, session-size field, or FSRS `w` editor. |

---

## Already encoded vs prose-only

### FastCheck properties today

Only these three files import `effect/FastCheck`:

| File | Properties that already match a candidate |
| --- | --- |
| `src/engine/mastery/live.test.ts` | INV-B-MST-01, INV-B-MST-02, INV-B-MST-03 (determinism, coverage, bounds, monotonic decay; plus a decay-over-a-year check) |
| `src/engine/graph/live.test.ts` | INV-B-GRF-01 … INV-B-GRF-04 |
| `src/engine/scheduler/live.test.ts` | INV-B-SCH-01, INV-B-SCH-02 |

Mastery INV-B-MST-04 (recall vs derivation) is example-only.

### Source-scan / example tests (construction + CLI / Session)

| File | Candidates |
| --- | --- |
| `src/engine/no-cross-imports.test.ts` | INV-C-ENG-01, INV-C-ENG-02, INV-C-MST-01 (Clock provide) |
| `src/engine/mastery/live.test.ts` | INV-C-MST-01 (`Date.now`) |
| `src/engine/graph/live.test.ts` | INV-C-GRF-01 |
| `src/engine/scheduler/live.test.ts` | INV-C-SCH-01 |
| `src/session/live.test.ts` | INV-B-SES-03, INV-B-SES-04 (example), INV-C-SES-01 |
| `src/cli/handle.test.ts` | INV-B-LANG-01, INV-B-CLI-02…04, 07–09, 11; INV-C-CLI-01 |
| `src/cli/style.test.ts` | INV-B-CLI-09 (`NO_COLOR` / non-tty) |
| `src/cli/trees-view.test.ts` / `titles.test.ts` | INV-B-LANG-01, INV-B-CLI-11, INV-B-CLI-06 (matching only) |
| `src/store/jsonl.test.ts` / `memory.test.ts` | INV-B-STO-01, INV-C-STO-01 (opacity / missing file) |
| `src/codec/layers.test.ts` | INV-C-STO-01 (no derived fields on the wire) |

### Still prose-only (highest-value later properties)

These are locked in spec and either untested or only implicitly true of today's adapter:

1. **INV-B-CLI-05 / INV-B-SES-02** — `queue` (and any other pure command) on a missing log creates no file and no directory.
2. **INV-B-SES-01** — Session never prompts (consent stays in Session CLI).
3. **INV-B-CLI-01** — no user-facing env-var interface for tree / paths.
4. **INV-C-CLI-02** — no `--yes`.
5. **INV-B-CLI-06** — tree choice is per invocation, not process-sticky.
6. **INV-C-CLI-03** — isolated engine commands, one Tag each (commands themselves not in this checkout's help).
7. **INV-C-MOD-01 / INV-C-MOD-02** — how a **new** module is built.
8. **INV-B-SES-04** (recall-then-derivation half) and **INV-B-MST-04** — specified, example-only; good FastCheck promotions at those seams.
9. TTY Session TUI default (`KEY_DECISIONS.md`) — standing feel, remaining work, no property yet.

---

## What a later `INVARIANTS.md` should do (handoff, not this ticket)

- Copy ids and wording from this harvest. Do not invent new product rules.
- Attach one property (or source-scan) per id that is in force for this version.
- Cite the id from the test name or a comment; keep `effect/FastCheck`.
- Leave placeholders and parked rows in an "excluded" section, as above.
- Husky pre-commit as the lifecycle is a map decision ([issue 34](https://github.com/Galz648/Retention/issues/34)), not a product invariant harvested here.

---

## Sources

- `CONTEXT.md`
- `specs/mechanics/KEY_DECISIONS.md`
- `specs/mechanics/SCOPE.md`
- `specs/mechanics/TRADEOFFS.md`
- `specs/mechanics/ARCHITECTURE.md` (component list only)
- `specs/mechanics/components/ENGINE.md`
- `specs/mechanics/components/SESSION.md`
- `specs/mechanics/components/SESSION_CLI.md`
- `specs/mechanics/components/MASTERY.md` / `GRAPH.md` / `SCHEDULER.md` (Tag does/does-not; cited where they lock relations already tested)
- `src/engine/no-cross-imports.test.ts`
- `src/engine/mastery/live.test.ts`
- `src/engine/graph/live.test.ts`
- `src/engine/scheduler/live.test.ts`
- `src/session/interface.ts`, `src/session/live.ts`, `src/session/live.test.ts`
- `src/cli/handle.ts`, `src/cli/handle.test.ts`, `src/cli/style.test.ts`, `src/cli/trees-view.test.ts`, `src/cli/titles.test.ts`, `src/cli/main.ts`
- `src/store/jsonl.test.ts`, `src/store/memory.test.ts`, `src/codec/layers.test.ts`
- [Issue 34](https://github.com/Galz648/Retention/issues/34) (meta construction INV-C-MOD-01 only)
