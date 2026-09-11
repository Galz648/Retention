Gap signal — evidence of where a derivation broke. Impure as a component (it
appends to the event log). Session CLI owns consent.

Does: append `gap.observed` (card, sub-concept missed, what was said or absent,
severity, time); list pending entries in log order.
Does not: decide the interval (that is the grade), spawn tree nodes, change what
is due, import engine Tags, or prompt. It only captures evidence.

## Why

Bottom-up traversal needs the prerequisite layer to already exist at the right grain.
Top-down does not — it throws the derivation cold and reads *where the explanation
broke* to find the weak sub-concepts. That detail is only useful if it is written
down. The card still gets one rating; each missed sub-concept is its own
`gap.observed`. Repeated misses of the same `subConcept` across cards and sessions
are the strong signal — one miss is noise.

## Events

`gap.observed` is a fact: this sub-concept was missed on this card at this time.

- `id` — the card (internal; the person never sees it)
- `at` — Clock, not a sitting / session-id event
- `subConcept`, `observation`, `severity` (`core-error` | `gap` | `minor`)
- optional `suggests` (`prereqNode` or `subNodeUnder`) and `held`

No due date, interval, or brightness. Empty or whitespace-only sub-concept or
observation is not an event.

Not a field on `card.reviewed` — one grade is one rating; one derivation can yield
many misses.

## Isolation

Gap talks to Store and Codec. It never imports mastery, graph, scheduler,
Session, corpus I/O, or cli. Engine never imports gap. Mastery folds only
`card.reviewed`; gap events do not change Brightness.

Clock: `observe` lists Clock in `R`. Live does not construct or provide Clock.
Consent is in Session CLI.

## CLI

`[impure] gap` — queue number + severity + sub-concept + observation + tree title,
same identification as `grade`. Asks first. Piped input refuses.
`[pure] gaps` — pending misses by tree title, node title, prompt, sub-concept,
observation, severity. Never card ids, folder names, or the event tag.

A skill may call these commands. It does not write the log, `signals/`, or corpus.

## Not in scope here

Turning a gap record into an actual tree edit (new node, reactivated prerequisite)
— that is the top-down engine, still parked. Gap signal only produces the input.

`signals/2026-09-10-biology-ii.jsonl` is a historical example from before this
event existed. Do not import it. Do not write new files there.
