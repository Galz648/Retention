# Retention System — Specification

## Purpose

A system for retaining what I learn across university courses and self-directed study. It distinguishes two kinds of gap — **knowledge** (arbitrary conventions and facts) and **understanding** (reasoning I can regenerate) — and treats them differently, because the same review mechanism doesn't serve both.

## Principles

1. **Don't predict recurrence.** Nothing enters the system on first encounter. The trigger for promotion is hitting the same thing a second time, on a different day.
2. **Capture is cheap, curation is strict.** Recording something costs seconds and requires no judgement. Deciding whether it stays is a separate, deliberate act.
3. **Scheduling is deterministic.** Intervals and due dates are computed, never inferred. A language model may present, grade, and classify; it does not keep the books.
4. **One store, tagged.** Not per-subject silos — those break the moment a week gets busy.
5. **The user retains veto.** Any grade proposed by a model can be overridden.
6. **Each layer must be useful alone.** If a layer only makes sense in the presence of the others, the boundary is in the wrong place.
7. **State is derived, history is the truth.** Nothing is overwritten. Every change is an appended event, and current state is what you get by replaying them.

---

# Part I — The components

The system is a stack of independently useful pieces with defined interfaces between them. They are not phases of one program.

Below the line: **store**, **scheduler**, **core**. Above it: **clients** — a CLI, an agent, and later the knowledge tree.

## 1. The store

**What it is:** an append-only event log and nothing else.

**What it does:** append an event; read events back. That is the entire surface.

**What it knows:** nothing about cards, intervals, decks, or meaning. It holds opaque events in order.

**Why it's separable:** it is the only component that touches the outside world. Isolating I/O here is what allows everything above it to be pure.

## 2. The scheduler

**What it is:** a pure function over history. Events in, state out.

**What it does:** folds an event log into current state — which cards exist, which are due, what the next interval is after a given outcome.

**What it does not do:** any I/O whatsoever. It does not read the clock beyond what it is handed, does not read files, does not call anything.

**Why it matters:** purity is what makes replay real. If the scheduler ever needs input that isn't in the log, the ability to swap algorithms and recompute history is gone. This is the load-bearing constraint of the whole design, and it is easy to violate by accident.

### Card types

Two card types, distinguished structurally rather than by an optional field. The scheduler treats them identically for timing; only presentation and grading differ.

**Recall card**
- A prompt and its answer, plus tags.
- Reviewed in seconds. Self-graded.

**Derivation card**
- A prompt asking for an explanation built from scratch, plus tags.
- Carries **must-hits**: three or four claims a correct explanation has to assert.
- Must-hits accrete. When a review exposes a step that wasn't listed, it gets added, so the list grows into the shape of my actual blind spots.

These are a sum type, not one shape with nullable must-hits. Otherwise every consumer branches on an absence, and the distinction the whole system rests on gets encoded as a missing field.

### Queueing

- The scheduler returns everything due as a single queue, ordered recall-first, derivation-after. Recall acts as a warm-up; derivation builds on the names it loads.
- Card types are never interleaved card-by-card.
- Grading of derivation cards checks **coverage against the must-hits**, not quality in the abstract. This keeps it mechanical rather than a judgement call — and keeps the grading contract narrow enough that a model can be trusted with it.

## 3. The core

**What it is:** the thin composition of store and scheduler.

**What it does:** pulls events from the store, folds them through the scheduler, returns a queue; takes an outcome, turns it into an event, appends it.

**What it must stay:** thin. It is plumbing. If logic accumulates here, it belongs in the scheduler; if I/O accumulates here, it belongs in the store.

**The inbox** lives at this level too: raw captured entries awaiting curation, stored as events like everything else, handed back uninterpreted.

---

## 4. The CLI

**A first-class client, not a debug tool.**

**What it is:** a direct, non-conversational front end to the core.

**Why it's not an afterthought:** the success criterion is that review works with no model involved. That criterion only means anything if the CLI can do everything — capture, review, record, inspect. If it can, the agent is proven optional. If it can't, the agent has quietly absorbed logic that belongs below the line.

It is a peer of the agent, not a layer beneath it.

---

## 5. The agent

**What it is:** the conversational front end.

**What it does:** presents cards, grades explanations against must-hits, runs curation as a conversation, drafts card wording and must-hits, and answers *what should I do right now*.

**What it holds:** nothing. No state, no dates, no bookkeeping. Every fact it reports it has just read; every change it makes it has just written.

**Why it's separable:** it's replaceable. A terminal agent today, a phone client later, anything that can speak the core's interface. The intelligence lives in the conversation; the state lives below.

---

## 6. The knowledge tree

**A separate project.** A client of the core, not a part of it.

**What it is:** a map of concepts and their dependencies, with a record of how deeply I hold each one.

**What it knows:** concepts as nodes, edges between them, and a status per node representing depth of grasp — untouched, named, intuitive, mechanistic.

**What it does not know:** intervals, due dates, or anything about scheduling. It never computes when something should be reviewed.

**Why it's separable:** it answers a different question. The SRS answers *what should I review today*; the tree answers *what should I learn next, and what am I missing to learn it*. Either is worth answering without the other.

**Scoping note:** deriving edges is the hard part. The cheap first version takes a course's table of contents as a linear ordering and treats everything earlier as prerequisite. Cross-course edges are the genuinely hard case and are deliberately deferred.

**Not in scope for v1.**

---

# Part II — Composition

## The two interfaces

There are two boundaries that matter, and they harden at different rates.

**The event vocabulary** — between the store and everything above it. This is the expensive one. The premise of the log is that old events stay readable forever, so adding an event type is cheap and changing the meaning of an existing one is not. This is the real schema; everything else is derived from it.

**The core's operations** — between the core and its clients. Roughly: *what's due*, *record an outcome*, *add a card*, *capture*, *read the inbox*, *read history*. Nothing in that list mentions concepts, courses, or conversations.

The load-bearing constraint: if a new operation is needed that only makes sense for one particular client, it belongs in that client, not the core.

## How they compose

**Store → scheduler → core.** Events are read, folded into state, and returned. State is never stored; it is always the result of a fold.

**Client → core.** A client asks what's due, presents it however it likes, takes my response, and records the outcome. The core decides the next interval; no client ever proposes one.

**CLI and agent are peers.** Both speak the same operations. Neither can do something the other structurally cannot.

**Tree → core.** The tree **emits**: a node that reaches "I should hold this" produces cards, added like any others. The tree decides *what* enters; the scheduler decides *when* it returns. Once a card exists, its origin is irrelevant.

**Core → tree.** Review outcomes are already in the log. The tree reads them and updates node status — repeated failures on a concept's cards lower its grasp level, marking it for re-teaching.

**Agent → tree.** The agent fronts the tree the same way it fronts the SRS — same conversation, different questions. From my side there is one thing to talk to, even though there are two systems behind it.

**The loop closes by pull, not push.** Nothing runs in the background, nothing notifies. Whichever client wakes up next reads the current state.

## Dependency direction

```
store  ←  scheduler  ←  core  ←  { CLI, agent, tree }
```

The store depends on nothing. The scheduler depends on the event vocabulary alone. The core depends on both. Clients depend on the core's operations. **Nothing depends on a client.**

This means the tree can be built, abandoned, or replaced without touching the SRS; the agent can be swapped entirely; and the SRS keeps working if neither ever exists.

---

# Part III — Event sourcing

Every layer that holds state models it as an append-only log of events. Current state is not stored; it is computed by folding the log. Think of it as time-travel debugging applied to learning — any past state can be reconstructed, and the trajectory between states is itself data.

This matters most for the card store, where the history *is* the interesting artefact. A card's current interval tells you almost nothing. The sequence of encounters that produced it tells you how you learn.

## What an event is

An event is a statement of fact about something that happened, in the past tense, at a known time. It is never a command and never a computed value.

Events are **self-contained**: they carry everything needed to interpret them without consulting the state at the time they were written. An event recording a review outcome carries the outcome, not the resulting due date.

Events are **immutable**. Corrections are new events, not edits. When I override a proposed grade, that override is itself an event, sitting after the grade it corrects — so the log preserves both that the model judged one way and that I disagreed.

## Events per layer

**Card store.** A card came into existence, with its type, prompt, tags, and origin. A card was reviewed, with the outcome. A must-hit was added to a card, and what exposed it. A card was retired.

**Inbox.** Something was captured, with its raw text. An entry was promoted to a card. An entry was discarded — discarded, not deleted, so the log records what I chose not to keep and why.

**Knowledge tree.** A node's grasp level rose or fell, and what caused the change. An edge was asserted between two concepts. A node emitted cards.

## What this buys

**Progress over time.** Retention curves, which concepts decay and how fast, whether derivation cards actually stretch further than recall ones, how many inbox entries survive curation. None of this needs to be designed for in advance — it falls out of having the log.

**Rewind.** Any past state is reachable. What did my deck look like in March, before that course started.

**Replay under a different algorithm.** This is the strongest argument. Because outcomes are recorded rather than intervals, the scheduling algorithm is a pure function over the log. I can change it and recompute every due date from scratch, then compare the counterfactual against what actually happened. A system that stored due dates directly could never do this.

**A cleaner loop between layers.** There is no separate outcome log — the tree reads the same event log everything else reads and derives what it needs. There is one source of truth, not two things that can disagree.

**Debuggability.** When the scheduler does something surprising, the answer is always in the log. There is no hidden mutable state to reason about.

## Constraints this imposes

- Events must not embed derived values. If an interval calculation appears in an event, replaying under a new algorithm becomes impossible — the very thing the design exists to allow.
- Folding the whole log on every read stops being viable eventually. Periodic snapshots are the standard answer, and a snapshot must always be discardable — regenerable from the log alone, never the only copy of anything.
- Deletion is not free. If something genuinely must be expunged rather than superseded, that is a rewrite of history and should be rare and explicit.
- The event vocabulary is a public interface between layers. Adding an event type is cheap; changing the meaning of an existing one is not.

## Scope

The store is the event log; the card deck and inbox are both projections of it in v1. The tree adopts the same model when it is built, and its events live in its own store — the components share a pattern, not a log.

---

# Part IV — Flows

### Capture (mid-task, seconds)

I'm working on something unrelated and stall on a gap. I say what the gap is, in whatever words come out. It's appended to the inbox with the date. I get a one-line acknowledgement, no follow-up questions, and no prompt to classify. I return to what I was doing.

The design constraint: this must never become a conversation. If capture costs more than a few seconds of attention, it stops happening at exactly the moments it matters most.

### Weekly curation (~30 minutes)

I open the inbox and we walk it entry by entry. For each one, three questions:

- Is this an idea or a convention? Convention → recall. Idea → derivation.
- Have I hit this more than once, across different days? If not, discard it; it will return if it matters.
- Is there a real "why" to grasp, or is it arbitrary? Arbitrary always goes to recall, even when it feels conceptual.

Mostly I answer these, since I'm the only one who knows whether I've hit something before. Most entries are discarded — the inbox is deliberately over-inclusive and that shouldn't feel like failure.

Survivors become cards, drafted on the spot. Recall cards are a prompt and an answer, and I correct the wording if it's off. Derivation cards come with must-hits already drafted from the surrounding conversation — I skim them, cut anything not load-bearing, and move on.

At the end I'm told what entered each deck, and the inbox is empty.

### Daily review (10–15 minutes)

I ask what's due and am told the shape of the queue up front — how many recall cards, whether a derivation is waiting — so I know what I'm committing to before I start.

Recall first. Prompt, I answer in my head, I reveal, I say how it went. Seconds each, no discussion.

If a derivation is due it comes after the recall queue is empty, and I'm told the queue has changed mode. I explain the thing out loud, from scratch, without notes. My explanation is checked against the card's must-hits and I'm told which I covered and which I missed. If I disagree, I say so and my judgement stands.

Anything I missed that wasn't already a must-hit is offered as an addition to the card. I accept or decline.

### Asking what to do (any time)

I ask one open question — what should I be doing — and get a short status: what's due, what's overdue, whether the inbox has grown large enough to need curation, and, once the tree exists, which concepts have gone stale.

I choose. Some days that's everything; some days it's eight minutes of recall on a train. Absent any choice, the default is the recall queue alone.

### Learning something new *(tree)*

I say I'm working through a course or a topic. The tree tells me where I am in it and what's ready to learn given what I already hold — and if I'm reaching past a gap, names the prerequisite I'm missing and offers to start there instead.

When I've grasped a concept well enough to want to keep it, it emits cards into the store and they join the normal rotation. I don't hand-write those cards.

### Re-teaching a stale concept *(tree)*

At the start of a teaching session the recent outcome log is read. If I've failed a concept's cards repeatedly, its status has dropped and I'm told: this looked solid a month ago and doesn't now. The session starts there rather than wherever I intended to go.

Nothing notifies me of this between sessions. It surfaces when I next show up.

---

# Part V — Cadence

- **Recall:** ~10–15 minutes daily. The deck is not padded to fill a target.
- **Derivation:** one fixed weekly slot, ~30 minutes, covering roughly 6–8 prompts. Individual cards space out — weekly, then fortnightly, then monthly, as they go smoothly twice. The slot stays weekly and simply gets lighter; freed space is filled by newly earned derivations.
- **Curation:** weekly, ~30 minutes, in the same slot.

# Part VI — Scope

**In scope for v1:** the store, the scheduler, the core, a CLI over them, capture, curation, and an agent as a second client.

**Out of scope for v1:**

- The knowledge tree, in its entirety. It waits until curation has run long enough that missing prerequisites are a felt problem.
- Cross-course dependency edges, even once the tree exists.
- Any background process, daemon, or notification.
- Automatic classification at capture time.

## Success criterion

The review path is usable with no model involved — every operation reachable from the CLI alone. If the core can't be driven from a bare shell, the agent has absorbed logic that belongs below the line, and everything layered on top is decoration.
