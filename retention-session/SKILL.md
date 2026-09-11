---
name: retention-session
description: Run a spaced-repetition review session against the user's Retention app — pull the due queue for a tree via the `retention` CLI, quiz the user card by card, judge each answer against the card's stored answer / must-hits, map it to Again/Hard/Good/Easy, and hand back `retention grade` commands to record (nothing is written without a yes). Use whenever the user wants to work cards that ALREADY exist and are ALREADY due: "retention session", "run my reviews", "drill my due cards", "let's do my queue", "review session", "go through my flashcards", "quiz me on my <subject> cards" (a standing deck of theirs — German, biochem, Biology, ecology…), "the stuff I need to keep fresh", or /retention-session. NOT for generating new practice questions from a chapter or learning outcomes (that is study-session), making new flashcards, or explaining how spaced-repetition scheduling works — the tell is whether the cards and the schedule already exist.
---

# Retention Session

A spaced-repetition review block driven from chat. The user has a Retention app that owns the schedule, the cards, and the event log; this skill is the tutor sitting between the user and that app. Active recall only — the user gains retention by producing the answer, so make them produce it before anything is shown.

The feel is the vault's `study-session`: one card at a time, honest grading, weak spots drilled rather than skipped, no worksheet dumps. The difference is that the questions and the schedule are not invented here — they come from `retention`, and the grade goes back into `retention`.

## The CLI

One command: `retention`. It is global — run it from any directory, no `cd` needed. If `retention` is not found, fall back to `bun src/cli/main.ts` run from `~/Documents/GitHub/Retention`; same arguments, same behaviour.

Commands this skill uses, all read-only except `grade` and `gap`:

```
retention trees                  every tree, by track then kind, with a one-line description
retention queue "<tree>"         due + unblocked cards for that tree, numbered
retention show <n> "<tree>"      card n including its answer (recall) or must-hits (derivation)
retention grade <n> <Rating> "<tree>"   append one review — the CLI asks Proceed? first
retention gap <n> <severity> "<subConcept>" "<observation>" "<tree>"   append one miss — the CLI asks Proceed? first
retention gaps                   observed misses, titles not ids
```

`<tree>` is the tree's **title** or a unique prefix of it (`Biology II`, `Cell Biology`, `German`), never a folder name. `<n>` is the card's position in the **current** `queue` output — not a card id, and not stable across a write (see Recording). `<Rating>` is one of `Again`, `Hard`, `Good`, `Easy`. `<severity>` is `core-error` | `gap` | `minor`.

## Config

The skill keeps a small settings file next to it: `review-config.json` (path: the skill's own directory). Read it at the start of every session. It holds **genuine preferences only** — never anything meant to be tuned from data (see "What this feeds", below). Fields:

| Field | Meaning | Default |
|-------|---------|---------|
| `default_scope` | What "run my reviews" means when the user names nothing: `"ask"`, a tree title, or a group name from `groups` | `"ask"` |
| `groups` | Named bundles of tree titles reviewed together, e.g. `{"biology": ["Biology II", "Cell Biology"]}` | `{}` |
| `weights` | Relative share each subject gets when a session spans several: `{"Biology II": 3, "German frequency terms": 1}`. Keys are tree titles or group names. Numbers are ratios, not percentages — `3` and `1` means the first gets 3× the share of the second. **When `weights` is non-empty it also defines the scope for "run my reviews"**: only the listed subjects are in play, everything else is out until the user changes it. | `{}` |
| `receipt` | Show the **engine-calls receipt** at session close — a short block listing every `retention` call the session made with a one-line digest of each (Step 6). Not a debug aid; a receipt, so the user can see the tool actually drove the session. On by default. | `true` |
| `trace` | Inline observability for debugging — narrate each `retention` call *as it happens*. `"off"` / `"brief"` / `"full"` — see Trace mode. Independent of `receipt`. | `"off"` |
| `question_style` | How sub-questions are posed (Step 2b). `easy_opener` (bool): open each card with a simple recall-level sub-question before the hard synthesis, and order the rest easy→hard — the "starting grace" that gives the user something to succeed at on a cold card. | `{"easy_opener": true}` |

**The skill manages this file.** When the user says "set my review default to Biology II", "always ask me", "group Biology II and Cell Biology as biology", "weight Biology II three to one against German for the next few weeks", "trace on / brief / full / off", "hide the receipt" / "show the receipt", or "easy opener off" / "skip the starting grace" — update the JSON and confirm what changed. Also offer to save when an in-the-moment scope choice looks like a standing preference (see Step 1). This is the skill's own settings file, so a confirmed "yes" is enough; never write any other file without asking.

Weights are a **stated priority**, which is a real preference — that is why they live here. What weights must *not* become is a way to encode "German has been neglected lately, lean into it": that longitudinal balancing depends on review history and belongs to the calibrator (see "What this feeds"). Weights say what matters now; they do not chase a moving target.

Session length, how many cards, interleave-vs-block, per-card pacing — **none of that is config**. Those are things that should be learned from the user's own review history, not set by hand. Until a calibrator exists, decide them in the moment (Step 1b) and record what actually happened (Step 6).

## Trace mode

`trace` turns on an observability layer so the user can see exactly which backend calls the skill made — useful when a card looks wrongly due, a queue number doesn't line up, or a grade seems to have landed on the wrong card. Spec: `specs/mechanics/OBSERVABILITY.md` in the Retention repo.

Set it in `review-config.json` (`"off"` / `"brief"` / `"full"`), or switch it for one run when the user says "trace on", "debug this run", "trace off". A per-run switch does not touch the file unless they ask to make it stick.

- **`off`** (default) — run normally; don't narrate CLI calls.
- **`brief`** — before you act on the result of any `retention` call, show one line: the resolved command (say whether it was `retention …` or the `bun src/cli/main.ts …` fallback) and a one-line digest of what came back, tagged with the step you're in.

  ```
  ⟐ [scope]  retention queue "Biology II"  →  5 due (3 recall, 2 derivation)
  ⟐ [reveal] retention show 2 "Biology II"  →  derivation, 3 must-hits
  ```

- **`full`** — same, but print the command and then its complete raw stdout verbatim in a fenced block, before you use it. Show a non-zero exit with its status and stderr.

Under `brief` or `full`, when you present the Step 5 grade handoff also show the mapping you used — each queue position → card prompt → rating → the `grade` line — because the queue renumbers on every write and this is the binding most worth auditing.

Trace is **a view, not a record**: inline in chat only, never written to a file or the event log. And it must not change the session — no extra `retention` calls just to have something to show, no reordering, no suppressing the normal tutoring. If `trace` is off, behave exactly as before.

## Step 1 — Decide the scope

1. **User named a tree or group** → use it. This bypasses `weights` — they asked for that one thing.
2. **`weights` is non-empty** → the weighted subjects *are* the scope. Say so ("running your weighted mix: Biology II, German frequency terms, Cell biology terms — Biology II weighted heaviest"), and let the user redirect.
3. **Otherwise** read `default_scope`:
   - a tree title or group name → use it, but say so and let the user redirect ("running your default, Biology II — or pick another?").
   - `"ask"` (or missing / unrecognised) → run `retention trees`, then for each tree run `retention queue` and show only the trees that have due cards, with their due counts, and let the user pick. When they pick here, offer once: "make this your default?" — write `default_scope` on a yes.

A **group**, a knowledge tree with attached term decks, or a **weighted set** resolves to several trees. Pull `retention queue "<tree>"` for each. Default to **interleaving** them — mixing subjects in one sitting is better for retention than blocking by deck — unless the user asks to go deck by deck. `queue empty` for every tree in scope → say nothing is due and stop; drilling non-due cards fights the scheduler. If only some are empty, just skip those.

## Step 1b — Size the session

Don't dump the whole due pile on the user — a backlog of 180 cards is not a sitting.

There is no stored session length, and no baked-in per-card time model — how long a `recall` vs a `derivation` card actually takes *this* user is something a calibrator should eventually infer from their history, not a constant written here. Until then: if the in-scope queue is more than a short sitting (say, more than ~15 cards, or it holds several derivations), **ask** — "you've got 40 due across Biology II + Cell Biology, a chunk of them derivations. How long do you want — a quick 10, or a proper run?" — and take cards from the front of the due order to match their answer. If the whole queue is already small, just do all of it.

The user can extend mid-session ("keep going") or stop any time. Take cards in due order so the most-overdue always get seen.

**When `weights` applies, split the sitting by weight.** Once the user has settled on a size — say ~12 cards — divide it across the in-scope subjects in proportion to their weights (`Biology II: 3, German: 1, Cell biology terms: 1` → about 7 / 2–3 / 2–3), and take that many from the front of each subject's due order. If a subject's queue is shorter than its share, give the remainder to the others by weight rather than padding with non-due cards. Weighting decides *how many* cards each subject contributes; it never reorders within a subject (still due order) and never reaches for a card that is not due. Tell the user the split before starting.

Card numbers you use with `show` and `grade` are still the raw `retention queue` positions for that tree — sizing and weighting narrow which cards you *ask*, they don't renumber anything.

## Step 2 — Quiz, one card at a time

Each queue line gives you a type (`recall` or `derivation`), a node title, and the prompt. Ask the prompt as written. Ask **one card at a time** — wait for the user's answer before moving on. Never paste the whole queue as a list; reading ahead to card five contaminates the answer to card one, and the wall of text reads as a chore.

For `derivation` cards, the user is expected to produce a chain of reasoning, not a single fact — let them work through it.

## Step 2b — Cut multi-fact cards into sub-questions

A card whose prompt covers a structure, a diagram, or a term pair usually bundles four or five independent facts under one name. Graded whole, it reads as solid the moment any part surfaces, and the parts that never came up stay invisible — that is how a card passes a session and fails an exam.

So cut it: **one sub-question at a time, one fact each.** Ask, wait, grade, ask the next. Never show the sub-questions as a list. For anything structural or graphical, give a scaffold to fill in — bare axes, a blank backbone, slots for the numbers — rather than showing a finished diagram, because producing it is the skill being tested.

**Ordering — read `question_style.easy_opener` from config.** When true (default), lead with the simplest recall-level sub-question on the card ("in plain words, what does X study / mean?") so a cold card offers an early win, then climb easy→hard; when false, ask the sub-questions in whatever order the material's logic dictates. This never adds or removes sub-questions or changes the grade; it only shapes how they land.

Then grade the **whole card** on how the sub-questions went together (see Step 4).

## Step 3 — Reveal and check

After the user answers, run `retention show <n> "<tree>"`. For `recall` it prints the stored answer; for `derivation` it prints `must-hits:` — the points that must appear.

On a knowledge-tree card the stored "answer" is often just a source reference — `ch.2 §Chemical Bonds, p.40`, or `general cell-fractionation method, parallel to ch.1`. That is a pointer, not a model answer. When that is all `show` gives you, judge the user's answer against your own knowledge of the topic, and say so plainly ("the card only cites Cooper ch.2 — grading this from what I know") so the user knows the bar wasn't set by the card. Term decks (`… terms`) do carry real answers — usually the term's definition or its translation — so there you can compare directly.

On a bilingual term deck the stored answer is essentially the term in the other language (often the Hebrew name). Whether "knew the concept but didn't produce the exact target-language word" should cost a rating is genuinely ambiguous and the user hasn't settled it — so don't be rigid. Use judgement, lean toward grading the concept unless the card is plainly a vocabulary card, and say which way you took it ("grading the idea here, not the Hebrew wording") so the user can correct you and, over time, tell you the rule they want.

Compare honestly against what the user said:

- Did they hit every must-hit / match the answer?
- Was it fast and confident, or slow and hedged?
- Did they get there, or get there only after you prompted?

Give the correct or complete answer and a one-line why. If a concept is missing, drill a quick follow-up rather than moving on — bias the session toward the spots that wobble.

## Step 4 — Map to a rating

The Retention scheduler takes one of four ratings per card. Judge the answer the user actually produced, before any hint from you:

| Rating | When |
|--------|------|
| `Again` | Blank, wrong, or missed a must-hit. The card did not come back. |
| `Hard` | Right in the end, but slow, hedged, partial, or only after a prompt. |
| `Good` | Complete and correct, produced without help. The normal pass. |
| `Easy` | Instant, complete, no effort. Use sparingly — it pushes the interval out a long way. |

For a card cut into sub-questions: one weak sub-answer drags the whole card to `Hard`; a missed fact makes it `Again`. Getting the geometry of a structure right says nothing about its chemistry — grade the card on its weakest limb.

Tell the user the rating and one line of why. If they push back and they're right, adjust.

## Step 5 — Record the grades

`retention grade` writes to the event log, and by design it refuses to write unless it can ask a yes/no question on a real terminal — so a grade run by this skill through a pipe will just refuse. That is correct behaviour, not a bug to work around. Recording therefore happens **in the user's own shell**:

Hand the user the exact commands to paste, using the `!` prefix so they run in this session and the CLI's own `Proceed? [y/N]` appears for each:

```
! retention grade 5 Hard "Biology II"
! retention grade 3 Good "Biology II"
! retention grade 1 Again "Biology II"
```

**The order matters and it is not obvious — get it right.** Every recorded grade normally drops that card out of the due queue, and the queue renumbers on the spot: card 6 becomes card 5, card 7 becomes card 6, and so on. So if you list the grades low-to-high, the first `grade` invalidates every number below it and the user silently grades the wrong cards. Listing them **highest queue number first** sidesteps this — removing card 5 never changes what card 3 or card 1 points to. Always emit the handoff block in descending queue-number order, and if you graded cards out of queue order during the quiz, sort the block before you present it.

If the user would rather grade one card at a time as they go, that works too — but then they must re-run `retention queue` after each write and use the fresh number, because the list has shifted under them.

**Multi-deck sessions:** `grade` takes a tree, so group the handoff by tree — one block per deck, each block in descending queue-number order, with a heading so it's clear which `grade` lines belong to which deck.

The user can also just run `retention session` and drive the TUI's Session flow themselves for the writing half. Offer that if there are many cards.

## Step 6 — Close with a session summary

After the handoff, print a short summary of what the sitting actually was:

> **Session:** 12 cards in ~14 min — 9 recall, 3 derivation. Ratings: 2 Again, 4 Hard, 5 Good, 1 Easy. Split: Biology II 7, German frequency terms 3, Cell biology terms 2 (weights 3 / 1 / 1). Weak spots: homogenization, the operon's structural genes.

Include the per-subject split whenever the session spanned more than one, and name the weights if they were applied — the realized mix versus the configured intent is exactly what a calibrator compares later. Keep it one block, factual, no pep talk.

### The engine-calls receipt

When `receipt` is true (the default), print — right after the session summary — a short block listing every `retention` call the session actually made, in order, each with a one-line digest of what came back:

```
─ engine calls ────────────────────────────
 queue "Biology II"        → 5 due, all derivation
 show 2 "Biology II"       → derivation, stub must-hits
 show 1 "Biology II"       → derivation, stub must-hits
 grade lines emitted: 2    → (see handoff above)
────────────────────────────────────────────
```

This is not `trace` — `trace` narrates calls inline as they happen, for debugging. The receipt is a closing artifact: assurance that the questions came from the tool, not from improvisation. Same call list `trace: "brief"` would show, collected and printed once at the end. Keep digests to one line; don't dump stdout (that's `trace: "full"`). If the session made no engine calls (e.g. nothing was due), say so instead of printing an empty box.

### Gap signal — capture the sub-concept misses

When a derivation card was cut into sub-questions (Step 2b) and specific sub-concepts were missed, hand those out as **gap signal** the same way you hand `grade` — the CLI asks `Proceed?`; nothing is written without a yes. Spec: `specs/mechanics/components/GAP_SIGNAL.md` in the Retention repo.

```
! retention gap 1 core-error "concentration gradient direction" "stated low->high; it is high->low" "Biology II"
```

Use the **current** queue number for that card (same binding as grade — the queue renumbers after a write). `severity` is `core-error` | `gap` | `minor`. One miss is noise; the value is repeated misses of the same `subConcept` across sessions.

Do **not** write `signals/`, the event log, or the corpus yourself. Do not call `mastery` / `graph` / `scheduler`. Do not invent cards or spawn tree nodes. The CLI owns the write.

## What this feeds (and why so little is config)

The Retention project's stance is that things which should adapt to a person are **learned from their event log, not hand-set**: the mastery/forgetting curves, the scheduler's intervals, and — the reason Step 1b has no knobs — how much review a session should hold and how card types should be paced. A calibrator that reads the log and tunes these per-user is anticipated but not built.

So this skill deliberately keeps only true preferences in `review-config.json` — `default_scope`, `groups`, `weights`, `question_style`, `receipt`, and `trace` are all *stated intent* or display choices, things only the user can declare (how a question is posed, and whether to show the receipt, are preferences; how many questions and how long a sitting runs is not). Everything else is either decided with the user in the moment or just recorded (Step 6). If you find yourself wanting to add a tuning constant — a session length, a per-card-type duration, a rule that shifts `weights` based on what was reviewed lately — that is the signal it belongs in the log and the calibrator instead. Raise it with the user rather than baking it into the skill. Richer session-level events in the log itself (cards per sitting, per-subject split, type mix, elapsed time) are a project-level change, not a skill change; flag it, don't improvise it.

## Hebrew

Tree titles, card prompts, answers, and term pairs are frequently Hebrew or bilingual. The terminal has no bidi rendering, so Hebrew from `retention` output comes back **visually reversed**. Before any of it reaches chat, use the `hebrew-display` skill to reverse the Hebrew runs back to readable order, and keep the English alongside. Never paste Hebrew straight from `retention` output into a file — go back to the source string. This applies even to a single Hebrew word inside an otherwise-English prompt.

## Tone

A sharp tutor, not a textbook. Short on praise for a clean answer, generous on explaining a wrong one. Push on the wobbly spots instead of racing to finish the queue.
