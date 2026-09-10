# Retention System — Open Questions

Companion to the main spec. Everything here is unresolved.

Two parts. **Part I** is the scannable version — the questions themselves, nothing else. **Part II** is the same list with the reasoning behind each one.

Items are tagged by when they need an answer:

- **[blocker]** — must be decided before the first line of code, or it will be decided by accident.
- **[soon]** — will surface within the first weeks of use; fine to defer, not fine to forget.
- **[deferred]** — genuinely later, or tied to the knowledge tree.

---

# Part I — Overview

## Scheduling
- Which interval algorithm. **[blocker]**
- What vocabulary an outcome uses — and note this is the one decision replay can't undo. **[blocker]**
- Whether recall and derivation share an algorithm or just parameters. **[soon]**
- What happens to the queue after a gap of days. **[soon]**
- How repeatedly-failed cards get detected and retired. **[soon]**

## Cards
- Where must-hits come from for the first, cold-start batch. **[blocker]**
- What happens when a must-hit itself encodes a misunderstanding. **[soon]**
- Whether must-hit accretion is bounded. **[soon]**
- Whether editing a card preserves its history or replaces it. **[soon]**
- Where tags come from and whether they're constrained. **[soon]**
- Card kinds beyond `recall` and `derivation` — `exercise` (worked application), `challenge` (unseen problem, e.g. an unfamiliar proof) — and whether kinds of all four can share one dependency graph. **[deferred]**

## Grading
- Whether a model can be trusted to match paraphrase to must-hits. *(Assumed yes.)* **[soon]**
- Whether it stays calibrated, or drifts toward leniency. **[soon]**
- Whether must-hits are written as claims or as phrasings. **[blocker for authoring]**
- Coverage without correctness — right points, wrong reasoning. *(Accepted cost.)* **[soon]**

## Curation and capture
- How a second encounter is detected at all. **[blocker for the design]**
- What happens when the inbox is too large for one session. **[soon]**
- Whether curation and derivation review really share a slot. **[soon]**
- Whether discarded entries are ever read back. **[deferred]**

## Review experience
- Whether derivation is spoken, typed, or self-reported. **[blocker]**
- Whether self-grading on recall stays honest. **[soon]**
- What a partially-completed session does to due cards. **[soon]**
- Whether a veto overrides the grade that feeds the scheduler. **[soon]**

## Event log
- Snapshot cadence. **[deferred]**
- How the event schema evolves. **[soon]**
- Whether genuine deletion is ever supported. **[deferred]**

## Agent and packaging
- Where the store lives and how the agent finds it. **[blocker]**
- Whether capture works away from a terminal. **[soon]**
- How much the agent volunteers unasked. **[soon]**

## Knowledge tree
- Edge derivation beyond a table of contents. **[deferred]**
- Concept granularity. **[deferred]**
- Top-down vs bottom-up traversal — a configurable mode: throw the derivations cold and infer weak sub-concepts from performance, or master prerequisites first and unlock derivations via the graph. **[deferred]**
- Who assigns status, on what evidence. **[deferred]**
- What triggers emit. **[deferred]**
- Concepts worth holding that never become cards. **[deferred]**

## Meta
- Is the knowledge/derivation split real in practice. *(Provisionally accepted.)* **[soon]**
- Is weekly curation realistic. **[soon]**
- How would I know any of this is working. **[soon]**
- Scope creep toward the tree. **[ongoing]**

---

# Part II — Detail

## 1. Scheduling

**Which interval algorithm.** [blocker]
The spec says scheduling is deterministic but never says by what rule. Taking SM-2 or FSRS off the shelf is the obvious move, and the event log means it can be swapped later at no cost — but *something* has to be chosen to start.

**What vocabulary an outcome uses.** [blocker]
Binary pass/fail, a four-point scale, something else?

This is the one decision event sourcing does not protect. Replay works because the log stores what happened rather than what was decided — so a new algorithm can recompute every interval from the same history. But the algorithm's input is whatever was recorded, and no replay recovers detail that was never written. Start with pass/fail, later want easy/good/hard/again, and the old history simply can't feed the new algorithm; useful history restarts from the day of the change.

Recording more granularity than currently needed is cheap, since a coarser algorithm can always collapse detail. The reverse is impossible.

**Whether recall and derivation share an algorithm.** [soon]
The spec asserts derivation skill decays more slowly, which implies different curve parameters at minimum. Unclear whether that's a parameter difference or a different algorithm entirely.

**What happens after a gap.** [soon]
Miss ten days and the queue explodes, which is precisely when the system is most likely to be abandoned. Does the backlog get capped, spread out, or shown in full? This is a retention-of-the-user problem, not a retention-of-knowledge problem, and it's the most common failure mode of every SRS.

**Leeches.** [soon]
A card failed repeatedly is a broken card, not a hard one. No mechanism exists for detecting or handling that. Retirement is mentioned as an event type but nothing triggers it.

---

## 2. Cards

**Cold-starting must-hits.** [blocker]
At curation the model drafts must-hits from conversational context. For the first batch of cards there is no such context, so they'll be hand-written. Three-to-four is asserted as the right number with no evidence behind it.

**Must-hits that encode a misunderstanding.** [soon]
If a drafted must-hit is subtly wrong, grading enforces the error indefinitely, and the mechanism that's supposed to keep me honest becomes the thing that entrenches a mistake. There's no review path for must-hits themselves.

**Unbounded accretion.** [soon]
Must-hits grow every time a review exposes a gap. Nothing prunes them. A card could accumulate fifteen points and become unpassable — and the accretion rule means a bad week makes it permanently worse.

**Editing versus replacing.** [soon]
If a card's prompt is wrong, is that an event on the existing card or a retirement plus a new card? Affects whether review history survives a rewording, which affects whether interval progress survives it.

**Tag taxonomy.** [soon]
"One store, tagged" is the load-bearing alternative to per-subject silos, but nothing says where tags come from, whether they're freeform, or who assigns them. Freeform tags reliably rot; a fixed taxonomy reliably fails to fit.

**Card kinds beyond recall and derivation.** [deferred]
Two kinds exist today: `recall` (a fact that must be memorised) and `derivation` (something re-derived from a principle). A stated use of the system is to **mix more kinds in one dependency graph**:

- `exercise` — a worked application of a known method. Not memorised, not derived from a principle — *executed*. Decays like a motor skill: slower than recall, and lapses show as clumsiness before failure.
- `challenge` — an unseen problem: an unfamiliar proof, a transfer task, a question the method has to be *found* for. Success is evidence the underlying concepts are not just held but usable. A `challenge` failure localises differently from a `derivation` failure — it can mean the pieces are all there but the assembly isn't.

Open: whether these are genuinely distinct scheduling curves or just parameters on `derivation` (same shape as the recall-vs-derivation question); whether a `challenge` card even *has* must-hits or is graded purely on solved / not-solved plus a gap note; and whether one graph can carry edges like `recall → derivation → exercise → challenge` on the same concept (a natural ladder) without the eligibility logic getting muddy. Mastery's per-type decay curve (MASTERY.md — "recall fast, derivation slow, practice between") already anticipates a third; this is the fourth.

---

## 3. Grading

Must-hits exist to make derivation grading **objective** — a coverage check rather than a judgement of quality. That's the whole reason they're worth authoring: checking whether an explanation asserted a specific claim is a lookup, and a model does lookups consistently. The working assumption is that a model can map what I actually said onto the listed claims well enough to be trusted with it.

That assumption is probably sound. The questions below are about where the objectivity leaks.

**Paraphrase matching.** [soon]
I say the right thing in words the must-hit doesn't use. Something then has to decide whether that counts, which is semantic interpretation rather than pure matching. Still far narrower than judging an explanation wholesale, and close to the most reliable thing a model does — but it isn't mechanical.

**Claims versus phrasings.** [blocker for authoring]
The mitigation for the above is in how must-hits are written. A must-hit stated as a claim — *resolution stops at the first match* — admits any phrasing that asserts it. A must-hit stated as a particular wording invites arguments about wording. This has to be decided before the first cards are written, because it's a habit, not a setting.

**Calibration drift.** [soon]
The likelier failure isn't mismatching, it's leniency. A model grading my explanation tends to be generous: it fills gaps sympathetically, reads intent into a half-finished sentence, credits gesturing at the right idea. Because grades feed intervals, generous grading quietly stretches cards until one fails badly much later, long after the cause.

Cheap mitigation, worth specifying now: require the grader to **quote the span of my explanation that satisfies each must-hit**. If it can't point at the words, it can't tick the box. That turns "did they convey this" into "where did they say it," which is much harder to be lenient about.

**Coverage without correctness.** [soon]
I can hit every point and still reason wrongly — right steps in the wrong order, or a bad justification linking them. Coverage-checking cannot catch this by construction. Accepted as the cost of mechanical grading, on the assumption that the usual failure of a derivation attempt is omission rather than subtle wrongness. Worth revisiting if that assumption proves false.

**What to watch for in the first weeks.** If I find myself arguing with the grader about wording, that's a signal the must-hits are written as phrasings. If I find myself passing cards I know I didn't really explain, that's calibration drift.

---

## 4. Curation and capture

**Detecting the second encounter.** [blocker for the design, not the code]
The core promotion rule is "hit it twice across different days" — and the system has no way to know. It relies entirely on my memory of having captured something before. If the inbox is fifty entries deep, that memory is unreliable. Some fuzzy matching at capture time, or a nudge at curation, may be the only thing making the central rule enforceable.

**Curation when the inbox is large.** [soon]
Thirty minutes is budgeted. An inbox of forty entries doesn't fit, and the likely outcome is skipping curation entirely, which breaks the whole pipeline. Unclear whether curation should be time-boxed with a carry-over, or whether the inbox should be triaged before the session.

**Whether curation and derivation review can share a slot.** [soon]
Both are budgeted at thirty minutes weekly and both are placed in "the same slot," which means an hour, not thirty minutes. The spec reads as if describing one thirty-minute commitment while actually describing two. This matters because the weekly session is the thing most likely to lapse, and an hour lapses more easily than half an hour. Either state that it's an hour, or split them across two days.

**Discard as an event.** [deferred]
Discarded entries stay in the log, which is right. But nothing reads them. There may be signal in what I repeatedly capture and repeatedly bin.

---

## 5. Review experience

**Spoken derivation.** [blocker]
Derivation cards ask for an explanation out loud. Whether that means voice input, typed-instead-of-spoken, or spoken-then-self-reported changes the design substantially, and the answer may differ on desktop and phone. It also interacts with grading: span-quoting requires a transcript to quote from.

**Self-grading honesty on recall.** [soon]
Recall cards are self-graded on the grounds that it works fine. It mostly does, but the failure is silent and slow, and there's no signal in the log that would reveal it.

**Partial sessions.** [soon]
The single-queue design assumes you work through it. "Eight minutes on a train" implies leaving a derivation card undone. Does an untouched due card just stay due, and does the interval care that it was skipped rather than failed?

**Does a veto affect scheduling.** [soon]
Overriding a proposed grade is recorded as an event. Whether the scheduler uses my grade or the model's is not stated. It should presumably be mine — but then the model's grade is decorative, and it's worth asking why it's produced first.

---

## 6. Event log mechanics

**Snapshot cadence.** [deferred]
Acknowledged as necessary, unspecified. Not a real problem for years at personal scale.

**Schema versioning.** [soon]
Events are immutable and the vocabulary is described as a public interface between layers. Nothing says how a new field on an existing event type is handled, or how old events are interpreted by newer code. This gets painful exactly once, at the worst time.

**Genuine deletion.** [deferred]
Named as rare and explicit, with no mechanism.

---

## 7. Agent and packaging

**Where the store lives and how the agent finds it.** [blocker]
Trivial to answer, but unanswered, and it determines whether this works from more than one machine.

**Multi-device.** [soon]
Capture wants to happen wherever I am — including away from a terminal. An append-only log syncs more gracefully than mutable state, which is a point in the design's favour, but nothing has been decided.

**How much the agent volunteers.** [soon]
"What should I do right now" is the entry point, with the recall queue as the default. Whether the agent proactively raises a stale inbox, or only answers what's asked, is a tone decision that will determine whether the thing feels like a tool or a nag.

---

## 8. Knowledge tree

**Edge derivation beyond a table of contents.** [deferred]
The cheap version treats sequence as dependency. That is wrong in a way that will matter — most syllabus orderings encode pedagogy, not prerequisite structure.

**Concept granularity.** [deferred]
What counts as one node. Too coarse and status is meaningless; too fine and the tree is unmaintainable.

**Top-down vs bottom-up traversal.** [deferred]
Two ways to walk the same tree, worth making a configurable mode per tree (or per session):

- *Bottom-up* — the current model. Master the prerequisite nodes first; a derivation becomes due only once its `needs` edges are lit. The queue is the topological frontier. Safe, but a cold start means the frontier is just the graph roots and the finer concepts under them are invisible until seeded.
- *Top-down* — throw the derivation cards cold, before anything below them is known. Grade the explanation, then use *where it broke* — which must-hits were missed, where the reasoning stalled — to infer which sub-concepts the learner is actually weak on, and activate or spawn those finer nodes bottom-up **from evidence** rather than from a pre-built tree. Performance drives granularity instead of the seeder guessing it up front.

Top-down needs: must-hits rich enough that a miss localizes to a concept (today's roots carry stub must-hits — `["Biology I (assumed root)"]`), and a rule for turning "missed this point N times across cards" into a new node or a reactivated prerequisite. Bottom-up needs the prerequisite layer to exist at the right grain in the first place.

The **input** side of top-down is a concrete feature, spec'd separately and not blocked on the fog: **gap signal** — persisting which sub-concepts a learner missed during a sub-question review. See [`specs/mechanics/components/GAP_SIGNAL.md`](specs/mechanics/components/GAP_SIGNAL.md); first hand-captured instance in `signals/2026-09-10-biology-ii.jsonl`.

Still in the fog, do not decide yet: whether to re-seed a tree (e.g. Biology II) at finer resolution, or wire an existing lower tree (Biology I, 226 nodes) in as its prerequisite layer via cross-tree edges. Either feeds bottom-up; top-down sidesteps the choice by deriving the layer from use.

**Status vocabulary.** [deferred]
Untouched / named / intuitive / mechanistic is a first guess. Who assigns a level, and on what evidence, is unaddressed.

**What triggers emit.** [deferred]
"A node that reaches 'I should hold this'" is not a criterion.

**Concepts that never become cards.** [deferred]
Plenty of understanding is worth having without being worth reviewing. The tree needs to hold those too, which means node status can't be derived from card outcomes alone.

---

## 9. Meta

**Is the two-deck split real.** [soon]
The whole design rests on knowledge and understanding being distinct enough to need different mechanisms. Provisionally accepted as the right direction — it matches experience — but untested. If in practice most cards sit ambiguously between the two, the split adds ceremony without benefit. The first weeks of curation will show this quickly.

**Is weekly curation realistic.** [soon]
Everything downstream depends on a recurring session actually happening. It's the single most likely thing to lapse, and when it lapses the inbox grows, which makes the next session harder, which makes lapsing more likely.

**How would I know this is working.** [soon]
No success measure exists beyond "the backend runs from a shell." The event log makes measurement possible — retention curves, promotion rates, interval growth — but nothing says what good looks like, so there's no way to tell improvement from mere activity.

**Scope creep toward the tree.** [ongoing]
The tree is the interesting problem and is explicitly out of scope. The realistic risk is spending future sessions refining the spec rather than using the system.
