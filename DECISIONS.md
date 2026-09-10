# Decisions log

A running ledger of product-direction choices — the calls made while using the system,
distinct from `specs/mechanics/KEY_DECISIONS.md` (architecture, locked for this version).
Newest first. Each entry: what was chosen, and where it lives.

---

## 2026-09-11

**Forester is a programmatic pipeline, not a loose agent.** It ingests a course's real
materials — learning outcomes (the goal spine), textbook, assignments, past exams — and
proposes a corpus tree anchored to those outcomes, with a coverage report for outcomes
that have no node. Fixed stages, model judgement contained inside them, every node
traceable to a source and a goal. Supersedes the "model-driven, non-deterministic, runs
as an agent skill" stub. Still out of scope for the CLI version; this is a hand-off spec.
→ `specs/mechanics/components/FORESTER.md`, `ARCHITECTURE.md`, `ingestion-process.md`.

**Engine-calls receipt is default on.** Every review session closes with a short block
listing the `retention` calls it made, one-line digest each. Not a debug aid — a receipt
that the tool drove the session. Config field `receipt` in the skill, default `true`;
inline `trace` stays a separate debug mode, default off.
→ `retention-session/SKILL.md` § Step 6, `specs/mechanics/OBSERVABILITY.md`.

**Card kinds beyond recall and derivation — direction, not built.** The system should be
able to mix `recall`, `derivation`, `exercise` (executed application), and `challenge`
(unseen problem / unfamiliar proof) in **one dependency graph**, e.g. the ladder
`recall → derivation → exercise → challenge` on a single concept.
→ `OPEN-QUESTIONS.md` § Cards.

## 2026-09-10

**Top-down vs bottom-up traversal is a configurable mode.** Bottom-up = master
prerequisites first, derivations unlock via the graph (the native model). Top-down =
throw derivations cold, infer weak sub-concepts from where the explanation breaks.
The re-seed-finer vs wire-in-a-lower-tree question is left explicitly undecided.
→ `OPEN-QUESTIONS.md` § Knowledge tree.

**Gap signal is a feature.** Persist which sub-concepts a learner missed during a
sub-question review — training input for top-down. Provisional home: `signals/*.jsonl`;
final home (event field / new event / separate training data) is a store decision.
→ `specs/mechanics/components/GAP_SIGNAL.md`, `signals/`.

**Session question style is configurable.** `question_style.easy_opener` (default true):
open each card with a simple sub-question, climb easy→hard. A `numbers_hook` option was
tried the same day and **removed** — do not reintroduce.
→ `retention-session/review-config.json`, `SKILL.md` § Step 2b.

---

## Open — needs discussion, not yet a decision

**Can a whole university course be learned on this, bottom-up or top-down?**
Biology II as the test case: 42 derivation nodes, two term decks, Biology I (226 nodes)
unwired below it. Is the tree complete and granular enough to be the *primary* path
through a course, or only a retention layer over material learned elsewhere? Depends on
top-down existing, and on the coverage question (are the learning outcomes all
represented as nodes).
→ to record in `OPEN-QUESTIONS.md`.

**How to juggle several courses in one semester.** Each course needs a different share of
weekly review time, and that share shifts — an exam three weeks out pulls attention,
a course just started needs ramp, a finished course needs only maintenance. `weights`
covers a fixed stated priority but is explicitly *not* allowed to chase a moving target
(that is calibrator territory). Open: does multi-course allocation want a semester-level
plan object, a per-course "phase" (ramp / build / exam-run / maintenance), dynamic
reallocation from the event log, or some mix. Needs a real design pass.
→ to record in `OPEN-QUESTIONS.md`.
