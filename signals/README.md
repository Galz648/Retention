# signals/

Hand-captured **gap signal** records — which sub-concepts a learner missed during a
sub-question-by-sub-question derivation review. Training input for top-down tree
traversal.

Spec: [`../specs/mechanics/components/GAP_SIGNAL.md`](../specs/mechanics/components/GAP_SIGNAL.md).

**Provisional.** Format and location are not decided — this may become a field on
`card.reviewed`, a `gap.observed` event, or stay here as training data separate from the
event log. Until then the retention-session skill writes one `<date>-<tree>.jsonl` per
session, one JSON record per sub-concept miss.

One miss is noise. Repeated misses of the same `subConcept` across cards and sessions are
the signal.
