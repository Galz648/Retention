# signals/

Historical hand-captured **gap signal** records from before `gap.observed` lived in
the event log. Training-input examples only.

Spec: [`../specs/mechanics/components/GAP_SIGNAL.md`](../specs/mechanics/components/GAP_SIGNAL.md).

**Do not append here.** New misses go through `retention gap`. The retention-session
skill calls that command; it does not write these files. Do not import
`2026-09-10-biology-ii.jsonl` into the log.

One miss is noise. Repeated misses of the same `subConcept` across cards and sessions
are the signal.
