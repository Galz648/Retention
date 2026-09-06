# Which interval algorithm to fold first

**Ticket:** [Which interval algorithm to fold first](https://github.com/Galz648/Retention/issues/8)
**Question:** Which interval algorithm should the first scheduler *implementation* fold with — not which interface the scheduler exposes?

The interface is already fixed: a pure function of `(events, now) → state`. This note is the body behind that interface, so a later session does not pick SM-2 by accident. Swap cost is near zero if outcomes in the log are rich enough.

**Answer (one line):** Fold **FSRS-6** through official `ts-fsrs`, with `now` injected, fuzz off, and default weights. Record each review as a **1–4 grade** (Again / Hard / Good / Easy) plus timestamp. Derive difficulty, stability, retrievability, interval, and due on the fold. Do not write those into events.

---

## Method and limits

Claims below follow the source that owns them: Wozniak / SuperMemo for SM-2; Anki FAQ and Anki Manual for Anki’s SM-2 variant and FSRS product behaviour; MaiMemo / ACM KDD and IEEE TKDE papers plus the Open Spaced Repetition (OSR) algorithm wiki and library source for FSRS; npm / GitHub LICENSE and source for TS/JS packages.

Two paper PDFs were not readable in this pass. `https://www.maimemo.com/paper/` returned HTTP 500. ACM’s HTML for Ye, Su, and Cao (KDD 2022) sat behind a bot wall. Abstracts, DOI metadata, the authors’ public replication repos, and the first-party FSRS formula wiki (which cites those papers) are used instead, and marked as such.

The SuperMemo Delphi listing once published at `english/ol/sm2source.htm` now redirects to marketing copy. The 1990 algorithm description itself is still on SuperMemo’s archive.

This note does not implement a scheduler.

---

## 1. SM-2 (original)

**Owner:** Piotr Wozniak, *Optimization of learning*, Master’s thesis, University of Technology in Poznań, 1990; web adaptation dated 10 May 1998.

**Source:** [Application of a computer to improve the results obtained in working with the SuperMemo method](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)

Used in SuperMemo 1.0–3.0 (13 December 1987 – 9 March 1989). Named SM-2 because SuperMemo 2.0 was the most popular of those versions.

### Outcome scale

Six-point quality `q` in `0..5`:

| q | Meaning (Wozniak’s wording) |
|---|-----------------------------|
| 5 | perfect response |
| 4 | correct response after a hesitation |
| 3 | correct response recalled with serious difficulty |
| 2 | incorrect response; where the correct one seemed easy to recall |
| 1 | incorrect response; the correct one remembered |
| 0 | complete blackout |

Wozniak chose 0–5 for numeric-keypad ergonomics, not because six grades are theoretically required.

Pass/fail cut: `q < 3` restarts the interval sequence (`I(1)`, `I(2)`, …) without changing the E-Factor. `q = 4` leaves the E-Factor unchanged. After a session, items that scored below 4 are repeated the same day until they score at least 4.

### What the algorithm keeps

Per item:

- **E-Factor** (`EF`), start `2.5`, floor `1.3`. Below 1.3, Wozniak found items were repeated “annoyingly often” and usually had formulation flaws.
- **Repetition index** `n` (successful recalls in a row since the last fail).
- **Interval** `I` in days: `I(1) = 1`, `I(2) = 6`, then `I(n) = I(n-1) * EF`, rounded up if fractional.

EF update (additive form Wozniak treats as canonical):

```
EF' := EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
```

Equivalent reduced form: `EF' := EF - 0.8 + 0.28*q - 0.02*q*q`.

No random component. No wall clock inside the step: the step maps `(EF, n, I, q) → (EF', n', I')`. “Due” is `last_review + I` compared to a caller-supplied `now`.

### Events vs derived

**Store:** review timestamp and `q ∈ 0..5`.

**Derive on fold:** `EF`, `n`, `I`, due. All three SM-2 registers are a deterministic function of the quality sequence. Same-day re-reviews (`q < 4`) are extra events if they happen; they are not a stored schedule.

Do not store `EF`, `I`, or due on the event. Those are the values a later algorithm must be free to recompute.

---

## 2. Anki’s SM-2 variant

**Owner:** Anki project.

**Sources:**

- [What spaced repetition algorithm does Anki use?](https://faqs.ankiweb.net/what-spaced-repetition-algorithm.html) (Anki FAQs; as of Anki 23.10 Anki ships this *and* FSRS)
- [Studying](https://docs.ankiweb.net/studying.html) (Anki Manual: answer buttons, fuzz)
- [Deck Options](https://docs.ankiweb.net/deck-options.html) (Anki Manual: FSRS vs SM-2 options)
- Scheduler code path named by the FAQ: `rslib/src/scheduler/states` in [ankitects/anki](https://github.com/ankitects/anki)

Anki’s algorithm is based on SuperMemo 2, not identical to it. Differences the FAQ owns:

- Initial learning steps are user-controlled, not fixed at 1 day then 6 days. Failures during learning do not cut ease. Anki treats acquisition as a different stage from retention so new cards do not fall into “low interval hell.”
- **Four answer choices, not six.** One fail button, not three. FAQ rationale: failures are a small share of reviews, so ease can be steered by varying the three positive answers.
- Late reviews add extra days into the next interval (cards remembered late get a boost).
- Again resets the interval by default; the user can instead multiply by a “new interval” factor and can postpone failed mature cards to another day.
- Easy both raises ease *and* applies an extra bonus to the interval (more aggressive than stock SM-2).
- Ease floor 130% (same 1.3 research claim as Wozniak). Intervals cap at maximum interval. Every new interval except Again is at least one day longer than the previous.

### Outcome scale (Anki Manual)

| Button | Shortcut | Manual meaning |
|--------|----------|----------------|
| Again | 1 | Incorrect, or could not recall. Partial credit: if it would fail in real life, fail it here. Typical 5–20%. |
| Hard | 2 | Correct, but with doubt or a long recall. |
| Good | 3 / Space / Enter | Correct with some mental effort. Should be the common button (80–95%). |
| Easy | 4 | Correct with no mental effort. |

The Manual allows collapsing to Again + Good if four buttons are too many.

Review-card SM-2 arithmetic (FAQ):

| Button | Ease | Interval |
|--------|------|----------|
| Again | −20 percentage points; card enters relearning | current interval × “new interval” |
| Hard | −15 percentage points | current interval × hard interval (default 1.2) |
| Good | unchanged | current interval × ease |
| Easy | +15 percentage points | current interval × ease × easy bonus |

Hard / Good / Easy are then multiplied by the interval modifier. Late days are added as described above.

### Fuzz (Anki-specific, not SM-2)

The Manual’s “Fuzz Factor” section: after an answer on a *review* card, Anki applies a small random fuzz so cards introduced together do not stay glued on the same day. Learning cards get up to five extra minutes. **It is not possible to turn this off in Anki.** That is a product constraint, not a property of Wozniak’s SM-2.

### Events vs derived

Anki’s own review log (`revlog`, quoted in the OSR optimization wiki from Anki’s database structure) stores `ease` (which button), timestamps, and also `ivl`, `lastIvl`, `factor` — derived scheduling fields. Retention should **not** copy that. For replay, the facts are: which card, when, which of the four buttons. Interval and ease are fold output.

---

## 3. FSRS

### Lineage (papers vs the named algorithm)

OSR’s own README states FSRS “springs from” MaiMemo’s DHP model, itself a variant of Wozniak’s three-component (DSR) model.

**KDD 2022 (MaiMemo / SSP-MMC, not the later FSRS-6 formula sheet):**

> Junyao Ye, Jingyong Su, and Yilong Cao. 2022. A Stochastic Shortest Path Algorithm for Optimizing Spaced Repetition Scheduling. In *Proceedings of the 28th ACM SIGKDD Conference on Knowledge Discovery and Data Mining* (KDD ’22). ACM, 4381–4390. https://doi.org/10.1145/3534678.3539081

Abstract (ACM / author metadata): 220 million student memory-behaviour logs; a Markov memory model; a stochastic-shortest-path scheduler that minimizes review cost; 12.6% improvement over then-SOTA; deployed in MaiMemo. Replication code: [maimemo/SSP-MMC](https://github.com/maimemo/SSP-MMC). Full PDF not retrieved here.

**TKDE 2023 (extension):**

> J. Su, J. Ye, L. Nie, Y. Cao, and Y. Chen, “Optimizing Spaced Repetition Schedule by Capturing the Dynamics of Memory,” *IEEE Transactions on Knowledge and Data Engineering*, vol. 35, no. 10, pp. 10085–10097, Oct. 2023. https://doi.org/10.1109/TKDE.2023.3251721

Abstract: alternate memory prediction and schedule optimization; SSP via value iteration; reported 64% error reduction and 17% cost reduction vs baselines; 220 million-row dataset. Code: [maimemo/SSP-MMC-Plus](https://github.com/maimemo/SSP-MMC-Plus) (MIT). The repo calls this a substantial extension of the KDD paper and points at `https://www.maimemo.com/paper/` for free access (that URL failed with HTTP 500 in this pass).

**FSRS formulas in current use** are owned by the OSR wiki, edited by Jarrett Ye (Junyao Ye): [The Algorithm](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm). That page specifies FSRS-6 (21 weights) as the current default-parameter set, with earlier FSRS-5 / 4.5 / v4 / v3 / v2 / v1 / v0 recorded for history. `ts-fsrs` 5.4.2 advertises `FSRS-6.0` in its constants.

Anki’s FAQ describes the same three-component memory state and cites [open-spaced-repetition](https://github.com/open-spaced-repetition) as the FSRS home. SuperMemo’s later algorithms are proprietary; Anki uses FSRS instead. The FAQ points at [fsrs-vs-sm17](https://github.com/open-spaced-repetition/fsrs-vs-sm17) for a preliminary comparison “roughly on par with SM-17.”

### Outcome scale

FSRS grade `G` (wiki + `ts-fsrs` `Rating` enum):

| G | Name | Role |
|---|------|------|
| 1 | Again | fail |
| 2 | Hard | pass, harder |
| 3 | Good | pass |
| 4 | Easy | pass, easier |

`Rating.Manual = 0` exists on the TypeScript type for imported / forced due dates. It is not a review grade. `next()` / `review()` reject anything outside `1..4`.

Anki’s FSRS docs (Manual + fsrs4anki tutorial) are explicit: **Hard means recalled**, with hesitation. Pressing Hard when the card was forgotten makes later intervals “unreasonably high.” Internally, Again is fail; Hard / Good / Easy are pass. The tutorial also reports (as of that page) that FSRS is a little more accurate for people who mostly use Again and Good than for people who use all four buttons a lot.

Desired retention is a separate knob from the grade. Default 90%. The Manual: above 90% workload rises quickly; above 97% it can be overwhelming. Users should not edit the 21 weights by hand.

### Memory state (derived)

Per card, after at least one review (Anki FAQ):

- **Difficulty `D`** ∈ `[1, 10]` — inherent complexity; how hard it is to grow stability.
- **Stability `S`** — days for retrievability to fall from 100% to 90%.
- **Retrievability `R`** — probability of recall *now*; function of elapsed time and `S`. Changes every day; `D` and `S` change only on review.

FSRS-6 forgetting curve (wiki):

```
R(t, S) = (1 + factor * t / S) ^ (-w_20)
factor = 0.9^(-1/w_20) - 1    so that R(S, S) = 90%
```

Interval for requested retention `r` is the inverse: solve `R(I, S) = r` for `I`.

Initial stability after the first rating (FSRS v4 onward, still the FSRS-6 shape): `S_0(G) = w_{G-1}` — four different first-review stables for Again / Hard / Good / Easy. That is why a binary log cannot reconstruct FSRS: the first grade *is* the initial `S`.

Same-day / short-term stability (FSRS-6):

```
S'(S, G) = S * exp(w_17 * (G - 3 + w_18)) * S^(-w_19)
```

Mean reversion on `D` is there specifically to avoid SM-2 “ease hell” (wiki, FSRS v3/v4 notes).

Overdue reviews: as delay grows, `R` falls; a *successful* late review grows `S`, but subsequent stability **converges to an upper limit** rather than growing linearly with lateness the way SM-2 / Anki SM-2 do (wiki + Anki FAQ). The FAQ lists this as a reason FSRS handles a weeks-or-months break better than Anki’s default algorithm.

### Optimizer vs scheduler

Scheduling a single review is a deterministic function of `(memory state, elapsed days, grade, weights, requested retention)`.

Fitting the 21 weights is a **separate** job: maximum likelihood + BPTT over rating/interval time series ([The mechanism of optimization](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-mechanism-of-optimization)). Anki’s Manual: Optimize reads review history; “several reviews” are required; “less than a few hundred” is called out as a reason FSRS may not adapt well; monthly re-optimize is enough; do not copy someone else’s weights.

Default weights ship with the algorithm (FSRS-6 vector on the wiki, identical `default_w` in `ts-fsrs`). v1 does not need the optimizer.

The optimizer’s review-log schema ([fsrs-optimizer](https://github.com/open-spaced-repetition/fsrs-optimizer), BSD-3-Clause) is the right event shape:

| Field | Required for schedule fold? | Notes |
|-------|-----------------------------|--------|
| `card_id` | yes | |
| `review_time` | yes | ms timestamp, UTC |
| `review_rating` | yes | `{1,2,3,4}` |
| `review_state` | no | `{0,1,2,3}` = New / Learning / Review / Relearning; useful for training, derivable |
| `review_duration` | no | optional cost signal for training |

`timezone` and `day_start` matter for “which calendar day was this review” if same-day steps exist. With short-term steps off (recommended below), day boundaries still matter for “due today” but not for the stability update itself, which uses elapsed days between review timestamps.

---

## 4. Outcome-scale comparison

| Algorithm | Grades it consumes | Fail | Pass | Notes |
|-----------|--------------------|------|------|--------|
| SM-2 original | 0–5 | 0, 1, 2 | 3, 4, 5 | Three fail shades; EF updates on fail too; same-day drill for `q < 4` |
| Anki SM-2 | Again / Hard / Good / Easy | Again | Hard, Good, Easy | FAQ: one fail button on purpose |
| FSRS-6 | 1–4 (same names) | Again | Hard, Good, Easy | First-review `G` sets `S_0`; Hard is a pass |
| Binary pass/fail | 2 | fail | pass | Cannot recover Hard vs Good vs Easy; blocks FSRS initial `S` and Anki ease steering |

OPEN-QUESTIONS already states the one-way door: a coarser algorithm can collapse a richer log; replay cannot invent grades that were never written. **Record four grades.** Do not start binary.

Recording original SM-2’s extra fail shades (0 vs 1 vs 2) is optional richness Anki already declined. FSRS has no slot for them. Mapping 0–5 → 1–4 is lossy on the fail side; mapping 1–4 → SM-2 (`Again→1 or 2`, `Hard→3`, `Good→4`, `Easy→5`) is the usual collapse and is enough to *run* SM-2 later if we swap. That is why four grades, not six, is the log decision.

Derivation coverage (must-hits hit / missed) is not an FSRS input. The client / grader maps coverage onto `{1,2,3,4}` before the event is appended. That mapping is outside this ticket. The fold only sees a grade.

---

## 5. Events vs derived (Retention)

**Put in the event (facts):**

- `card_id`
- `reviewed_at` (the instant of the grade; this is `now` at write time, stored, not re-read from a clock on fold)
- `rating` ∈ `{1, 2, 3, 4}` with names Again / Hard / Good / Easy

Optional later, still facts: review duration; a veto event that supersedes a model-proposed grade (the scheduler should read the user’s grade — OPEN-QUESTIONS, unresolved, but the log can hold both).

**Derive on fold (never persist as truth):**

- FSRS: `difficulty`, `stability`, `retrievability(now)`, `state`, `reps`, `lapses`, `learning_steps`, `last_review`, `due`, `scheduled_days`
- SM-2 if we ever swap: `efactor`, `n`, `interval`, `due`

**Do not put on the event:** due date, next interval, ease / EF, D/S/R, “graduated”, learning-step index. Those are exactly the values replay under a new algorithm must recompute. SPEC Part III already forbids embedding derived values.

Algorithm parameters (`w`, `request_retention`, fuzz flag) are configuration, not per-review facts. If we later train weights, append a **parameter-set event** (or keep params as fold input beside `now`). Do not bake weights into review events.

---

## 6. TS / JS libraries

### `ts-fsrs` — use this for the FSRS fold

| | |
|---|---|
| Package | [`ts-fsrs`](https://www.npmjs.com/package/ts-fsrs) |
| Repo | [open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) |
| Version inspected | 5.4.2 (`packages/fsrs/package.json`) |
| Algorithm | FSRS-6 (`FSRSVersion`, `default_w` length 21 matches the wiki) |
| License | **MIT** ([LICENSE](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/LICENSE), copyright 2026 Open Spaced Repetition) |
| Engine | Node `>=20` |
| Listed by OSR | Yes — first entry under “Have a library of FSRS?” on [free-spaced-repetition-scheduler](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler) |

**API shape** ([packages/fsrs/README.md](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/README.md), [models.ts](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/src/models.ts), [default.ts](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/src/default.ts)):

```ts
const scheduler = fsrs({
  request_retention: 0.9,
  enable_fuzz: false,        // library default is already false
  enable_short_term: false,  // library default is true — override
})
const card = createEmptyCard(now)           // pass now; bare call uses `new Date()`
const { card: next, log } = scheduler.next(card, reviewTime, Rating.Good)
const preview = scheduler.repeat(card, reviewTime)  // all four outcomes
```

Lower-level, no Date objects: `next_state(memory, elapsedDays, grade)` then `next_interval(stability)` — README presents this for simulations and custom pipelines.

Replay helper: `reschedule(card, reviews, options?)` rebuilds state from a review history. That is the library’s fold.

**Clock:** `next` / `repeat` / `createEmptyCard` / `get_retrievability` all take a `DateInput`. The step does not call a system clock if the caller passes `now`. `createEmptyCard()` with no argument uses `new Date()` — **always pass `now`.**

**RNG:** `default_enable_fuzz` is `false` in `constant.ts`. When fuzz is on, `apply_fuzz` uses the `alea` PRNG seeded by a **seed strategy**, not raw `Math.random()` ([algorithm.ts](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/src/algorithm.ts), [strategies/seed.ts](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/src/strategies/seed.ts)). Default seed is `` `${review_time.getTime()}_${reps}_${difficulty * stability}` ``. That makes fuzz depend on the millisecond of `now` ([issue #131](https://github.com/open-spaced-repetition/ts-fsrs/issues/131)). Anki’s fuzz seed is `card_id + reps` (quoted there from `ankitects/anki`). `ts-fsrs` exposes `useStrategy(StrategyMode.SEED, GenSeedStrategyWithCardId('card_id'))` for that.

**Purity wrap:**

1. `enable_fuzz: false` — fold is a pure function of `(card, now, grade, params)`. No seed needed.
2. Always pass `now` into `createEmptyCard` and `next`.
3. If fuzz is ever turned on, inject a seed strategy from `(card_id, reps)` so replay does not depend on wall-clock milliseconds.
4. Keep the optimizer (`@open-spaced-repetition/binding`, `fsrs-optimizer`) **out of the fold**. Training is a batch job that may emit a new parameter-set event.

`enable_short_term` defaults **true**, with learning steps `['1m','10m']` and relearning `['10m']`. Anki’s Manual: learning steps of 1 day or greater are not recommended with FSRS; empty steps let FSRS-5+ own short-term. Retention’s cadence is daily recall and a weekly derivation slot, not minute-scale drills. **v1: `enable_short_term: false`.** Same-day SM-2-style drills are then out of the algorithm, which also matches “one review event is a fact, not a intra-session loop the scheduler invents.”

### `supermemo` — SM-2 reference wrap, not v1

| | |
|---|---|
| Package | [`supermemo`](https://www.npmjs.com/package/supermemo) |
| Repo | [VienDinhCom/supermemo](https://github.com/VienDinhCom/supermemo) |
| License | **MIT** (Copyright 2020 Vien Dinh) |
| API | `supermemo(item, grade) → item` |

`item` is `{ interval, repetition, efactor }`. `grade` is `0 | 1 | 2 | 3 | 4 | 5`. Implementation ([src/main.ts](https://github.com/VienDinhCom/supermemo/blob/master/src/main.ts)) is a straight transcription of Wozniak’s step: `q ≥ 3` advances `I(1)=1`, `I(2)=6`, else `round(I * EF)`; `q < 3` sets interval 1 and repetition 0; EF formula and 1.3 floor match the 1990 text. **No `Date`, no RNG.** Pure.

Due dates are the caller’s job. The README’s DayJS example uses `Date.now()` only in application code, not in the library.

This is the correct SM-2 wrap if we swap. It is not Anki SM-2 (no learning steps, no late-review bonus, no easy bonus, six grades).

### Other SM-2 TS packages (not recommended)

Several small MIT SM-2 ports exist (`@dtjv/sm-2` archived; `@x1ee7/sm2-spaced-repetition`; others). None are OSR-owned. `supermemo` is the widely downloaded, source-auditable, zero-dependency match for the 1990 algorithm. Anki SM-2 has no first-party TypeScript library; OSR’s [anki-sm-2](https://github.com/open-spaced-repetition/anki-sm-2) is Python.

### Optimizer packages (not the fold)

- [`fsrs-optimizer`](https://github.com/open-spaced-repetition/fsrs-optimizer) — Python, **BSD-3-Clause**
- [`@open-spaced-repetition/binding`](https://www.npmjs.com/package/@open-spaced-repetition/binding) — TS binding for training, pointed at from the `ts-fsrs` README

These read a review log and emit weights. They are I/O-adjacent and must stay outside the scheduler.

---

## 7. Recommendation

**Fold FSRS-6 via `ts-fsrs`.**

```
fsrs({ enable_fuzz: false, enable_short_term: false, request_retention: 0.9 })
```

Clock: the `now` already in the scheduler signature. RNG: none (fuzz off). Weights: library defaults (wiki FSRS-6 vector). Replay: `next` in event order, or `reschedule` over the card’s review slice.

**Why not SM-2 for v1**

- The accidental pick. This ticket exists so implementation does not default to it.
- Anki’s own FAQ: FSRS needs fewer reviews for the same retention and schedules delayed reviews better. OPEN-QUESTIONS already names “gap of days / exploded queue” as the common SRS abandonment mode. FSRS’s overdue behaviour is the one first-party comparison that speaks to that.
- Four-grade log matches Anki *and* FSRS. SM-2 original wants 0–5; Anki already dropped that.
- Official, MIT, clock-injected TypeScript implementation exists. Anki SM-2 does not have one.
- Default weights work; no training loop in v1.
- Ease hell is a documented SM-2 / Anki-SM-2 failure FSRS’s difficulty mean-reversion is designed to avoid.

**Why not implement FSRS ourselves**

The wiki formulas are public, but `ts-fsrs` is the OSR TypeScript module, MIT, and already takes `now`. Wrapping it is the smallest body that stays a pure fold.

**Why not Anki SM-2**

No official TS library. Learning-step and fuzz behaviour is entangled with Anki’s product (fuzz cannot be disabled there). We would reimplement a variant we do not want to own. If we ever want Anki-shaped SM-2, OSR’s Python `anki-sm-2` is the reference — still not a fold we should copy in v1.

**v1 wrap rules (implementation, later ticket)**

1. Inject `now`. Never call `createEmptyCard()` or `new Date()` inside the fold.
2. `enable_fuzz: false`. If fuzz is enabled later, seed from `(card_id, review_count)`, not `review_time.getTime()`.
3. `enable_short_term: false` so minute-scale steps do not fight the daily / weekly cadence.
4. Persist only `card_id`, `reviewed_at`, `rating`. Discard `ts-fsrs`’s `log.due` / `log.stability` / `log.difficulty` after the fold.
5. Recall and derivation share this fold for now (SPEC). Different `request_retention` or weight presets later are configuration, not a second algorithm.
6. Optimizer stays out. A future “train weights” job writes a parameter event; the fold reads current params as input.

---

## 8. Swap trigger

Swap the **fold body**, not the event vocabulary.

**Trigger:** After the log is large enough that FSRS’s own docs would treat optimization as meaningful (Anki Manual: a few hundred reviews is the floor below which “FSRS may not perform well”), **recall-at-due on this user’s log is systematically off the requested retention**, *and* refitting the default weights from that same log (optimizer as a batch job, new parameter event, same FSRS-6 fold) does not close the gap.

Then replace the fold with either a newer FSRS version or `supermemo` (SM-2) over the same `{1,2,3,4}` events, mapping `1→2, 2→3, 3→4, 4→5` if SM-2 is the replacement. Recompute every due date from the log. That is the replay the spec is built for.

**Not a swap trigger**

- “FSRS looks complicated.” Complexity sits behind the fold.
- Derivation vs recall wanting different spacing. That is two parameter presets (Anki already does preset-specific weights and desired retention), not a new algorithm.
- Minute-scale learning steps feeling wrong. Already disabled.
- Users pressing Hard when they forgot. Anki/FSRS document this as a grading-habit failure. Fix the grade mapping; do not change the algorithm.
- A gap-of-days backlog exploding the queue. That is a queueing / backlog-cap question (OPEN-QUESTIONS, soon), not an interval formula. FSRS is the better overdue *interval* of the two; it does not decide how many overdue cards to show.

**Failure mode that would make SM-2 the right swap:** FSRS’s DSR model, even after personal weights, mis-predicts this deck — especially derivation cards, which are not the vocab-scale items MaiMemo and Anki logs were trained on — so that due cards are routinely forgotten far above `1 - request_retention` or routinely trivial far below it. SM-2’s dumb EF ramp is then the simpler, inspectable fallback, and the four-grade log still feeds it.

---

## Sources

### SM-2

- P. A. Wozniak, *Optimization of learning*, Master’s thesis, University of Technology in Poznań, 1990; web adaptation 10 May 1998: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

### Anki

- Anki FAQs, “What spaced repetition algorithm does Anki use?”: https://faqs.ankiweb.net/what-spaced-repetition-algorithm.html
- Anki Manual, Studying (answer buttons, fuzz): https://docs.ankiweb.net/studying.html
- Anki Manual, Deck Options (FSRS section): https://docs.ankiweb.net/deck-options.html#fsrs
- Anki scheduler (FAQ pointer): https://github.com/ankitects/anki/tree/main/rslib/src/scheduler

### FSRS papers and first-party docs

- Ye, Su, Cao, KDD 2022: https://doi.org/10.1145/3534678.3539081 — abstract / metadata only here
- Su, Ye, Nie, Cao, Chen, TKDE 2023: https://doi.org/10.1109/TKDE.2023.3251721 — abstract / metadata only here
- maimemo/SSP-MMC: https://github.com/maimemo/SSP-MMC
- maimemo/SSP-MMC-Plus: https://github.com/maimemo/SSP-MMC-Plus
- OSR FSRS README: https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler
- The Algorithm (FSRS-6 formulas, Jarrett Ye): https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
- The mechanism of optimization: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-mechanism-of-optimization
- fsrs4anki tutorial: https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md
- fsrs-optimizer review-log schema: https://github.com/open-spaced-repetition/fsrs-optimizer

### Libraries (source + license)

- ts-fsrs README, LICENSE, `package.json`, `models.ts`, `default.ts`, `constant.ts`, `strategies/seed.ts`, `algorithm.ts`: https://github.com/open-spaced-repetition/ts-fsrs
- ts-fsrs seed / fuzz design: https://github.com/open-spaced-repetition/ts-fsrs/issues/131
- supermemo README, LICENSE, `src/main.ts`: https://github.com/VienDinhCom/supermemo
- fsrs-optimizer LICENSE (BSD-3-Clause): https://github.com/open-spaced-repetition/fsrs-optimizer/blob/main/LICENSE
