Gap signal — a review-client feature. Not built. Feeds top-down traversal (OPEN-QUESTIONS § Knowledge tree).

Does: when a derivation card is reviewed sub-question by sub-question (retention-session skill Step 2b), record which sub-concepts the learner missed, as structured data — the training signal a top-down engine needs to infer tree structure from performance instead of from a seeder's guess.
Does not: decide the interval (that is the grade), spawn tree nodes, or change what is due. It only captures evidence.

## Why

Bottom-up traversal needs the prerequisite layer to already exist at the right grain. Top-down does not — it throws the derivation cold and reads *where the explanation broke* to find the weak sub-concepts. But "where it broke" is only useful if it is written down. Today the sub-question grading happens live in chat and evaporates; the card gets one rating and the detail is lost. Gap signal is that detail, persisted.

## Shape (provisional)

One record per sub-concept miss observed in a session. Minimum fields:

- `session` — date or session id
- `tree`, `cardId` — the derivation card under review
- `subConcept` — short name of the thing missed ("concentration gradient direction")
- `observation` — what the learner actually said or failed to say
- `severity` — `core-error` (a load-bearing fact was wrong) | `gap` (absent, produced only after prompting) | `minor`
- `suggests` — optional: `{ "prereqNode": "..." }` or `{ "subNodeUnder": "..." }`, the client's guess at what tree change this points to
- `held` — optional companion: sub-concepts on the same card that came back cleanly, so a later process does not spawn a node where none is needed

Repeated misses of the same `subConcept` across cards and sessions are the strong signal — one miss is noise.

## Where it lives

Open, and this is a **store + engine decision, not a client one** — a review client must not invent its own event shapes in the shared log (same rule as GAPS "session-level events for the calibrator"). Options:

- a field on the existing `card.reviewed` event
- a new `gap.observed` event type
- a separate `signals/` artifact outside the event log, if these are training data rather than history

Until that is decided, the retention-session skill may write hand-captured gap records to `signals/<date>-<tree>.jsonl` in this repo, format as above, clearly marked provisional. First instance: `signals/2026-09-10-biology-ii.jsonl`.

## Not in scope here

Turning a gap record into an actual tree edit (new node, reactivated prerequisite) — that is the top-down engine, still in the fog. Gap signal only produces the input.
