Forester — builds a knowledge tree for a subject from that subject's real materials. A
**programmatic pipeline** with model-assisted stages, not a free-running agent. Proposes;
nothing lands without user approval.

Does: turn course materials (learning outcomes, textbook, assignments, past exams) into a
corpus tree — nodes, edges, cards — whose structure is anchored to the course's stated
goals, and report where coverage is thin.
Does not: read the event log; write to the corpus without approval; decide scheduling.

Status: **not built.** Out of scope for the CLI version (SCOPE.md). This spec is the
hand-off for when it is built. Supersedes the earlier one-line stub ("model-driven,
non-deterministic, runs as an agent skill") — see DECISIONS.md 2026-09-11.

---

## Why programmatic, not a loose agent

An agent asked to "make a tree from this book" produces something plausible and
unauditable — you cannot tell why a node exists, whether an edge is a real prerequisite
or just chapter order, or which learning outcomes were missed. Forester is instead a
fixed pipeline of named stages with typed inputs and outputs. A model does the
extraction and judgement *inside* stages; the stage boundaries, the intermediate
artifacts, the source references, and the corpus writes are deterministic and
inspectable. Re-running with the same inputs yields the same proposal, or a proposal
diff a human can read.

## The goal anchor

The course's **learning outcomes** (for OUI courses, תוצרי למידה from the portal) are the
spine. They define what the course is *for*. Every node Forester proposes carries a
reference to the outcome(s) it serves; a node that serves no outcome is flagged, not
silently kept. The textbook, assignments, and exams are evidence about *how* to reach
those outcomes and *what depends on what* — they are inputs, not the target.

This makes "is the tree complete for this course" answerable (OPEN-QUESTIONS § Meta):
it is the set of outcomes with no node covering them.

## Inputs

Each input is optional except the outcomes; more inputs sharpen the result.

| Source | What Forester takes from it |
|--------|----------------------------|
| **Learning outcomes** (required) | the goal list — the spine every node is anchored to |
| **Textbook** — TOC + chapter/section text | candidate concepts, definitions, worked derivations, cross-references (a real signal for prerequisite edges) |
| **Assignments** (מטלות) | which concepts are actually exercised, and problem→sub-skill dependencies — strong edge evidence |
| **Past exams** | question frequency and point-weight per topic → node importance; recurring problem types → `exercise` / `challenge` cards |
| **Syllabus / lecture list** | scoping (what is in vs out — e.g. "excl. §32.3"), rough ordering |

Inputs are supplied as files in a staging directory; Forester never reaches out to the
network or the OUI portal itself.

## Pipeline stages

1. **Parse** — each raw source → a typed intermediate: `outcomes[]`, `toc[]`,
   `problems[]` (with any stated sub-parts), `examQuestions[]` (with topic + points).
   Deterministic parsing; model only for messy PDF/HTML cleanup.
2. **Extract candidates** — propose concept nodes. Each candidate carries `sourceRefs`
   (book §, problem id, exam question id) and `outcomeRefs`.
3. **Dedup / merge** — collapse near-duplicate candidates (the `ingestion-process.md`
   TBD). Merge keeps the union of sourceRefs and outcomeRefs.
4. **Infer edges** — prerequisite structure from: problem sub-part dependencies,
   textbook "recall from §x" cross-references, exam questions that bundle topics.
   **Chapter order is not an edge** — flag any edge whose only evidence is sequence.
5. **Assign card kind + draft cards** — per node, pick `recall` | `derivation` |
   `exercise` | `challenge` (OPEN-QUESTIONS § Cards) from how the source treats it, and
   draft the card(s): must-hits for derivation quoted from the source, a worked instance
   for exercise, an unseen-but-in-scope problem for challenge.
6. **Coverage check** — outcomes with no node; nodes with no outcome; nodes with no
   card; edges flagged as sequence-only.
7. **Emit proposal** — a diff against the existing `corpus/<subject>/` (or a fresh tree
   if none): nodes/edges/cards added, changed, removed, plus the stage-6 report.
8. **Approve → write** — on the user's yes, write `nodes.jsonl`, `edges.jsonl`,
   `cards.jsonl`, `meta.json`. Same consent rule as `grade`: no `--yes`, piped input
   refuses.

## Outputs

- A `corpus/<subject>/` tree in the existing on-disk format (`meta.json`,
  `nodes.jsonl`, `edges.jsonl`, `cards.jsonl`).
- Every node's provenance retained: `sourceRefs` and `outcomeRefs` fields on the node
  record (schema addition — an engine/store change, flag don't improvise).
- A coverage report saved alongside (`corpus/<subject>/coverage.md`), regenerated on
  every run.

## Re-run and incremental

Adding a source (a new past exam, next year's assignment set) re-runs the pipeline and
emits a **diff proposal** against the current tree, not a rebuild. Nodes the user has
edited by hand are marked and never silently overwritten — a conflict is surfaced.

## Invariants

- Proposes only; the user approves before any corpus write.
- Never reads the event log (Forester shapes what *can* be learned; it must not see what
  *has* been).
- Every node traceable to a source and to a goal, or explicitly flagged.
- Deterministic pipeline; model judgement is contained to stages and always leaves a
  reviewable artifact.

## Open

- Node provenance fields (`sourceRefs`, `outcomeRefs`) are a corpus schema change —
  needs the engine/store owner, not Forester alone.
- Edge inference quality is the hard part and the whole point; stage 4 may need its own
  spec once there is a real corpus to test against.
- Whether `exercise` / `challenge` card kinds exist yet (OPEN-QUESTIONS § Cards) gates
  stage 5's full behaviour; until then it emits `recall` / `derivation` only.
- Relationship to the top-down gap signal: Forester builds the tree up front from
  materials; gap signal grows it from performance. They should converge on the same
  corpus — unclear yet how a gap-signal-spawned node gets a `sourceRef`.
