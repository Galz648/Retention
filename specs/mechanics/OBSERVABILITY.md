# Observability

Short spec. A cross-cutting concern for **clients** of `retention` (Session CLI, the retention-session agent skill, Forester later) — not a new component.

## Why

A client runs a sequence of backend calls the user never sees. When something looks wrong — a card that should not be due, a queue number that does not line up, a grade that seems to have landed on the wrong card — the user needs to see what the client actually asked the backend and what came back, without reading the client's source or attaching a debugger.

## Principle

Any `retention` client may offer a **trace mode**: an opt-in layer that echoes every backend invocation as it happens —

- the resolved command and arguments (including which binary: installed `retention` vs the `bun src/cli/main.ts` dev fallback),
- the client's reason for the call (which step of its own flow),
- exit status,
- output.

Trace mode is **observability only**. It changes nothing about what the client does: no extra calls made just to trace, no reordered calls, no suppressed normal output, no effect on consent or on what gets written. Turning it on must never turn a passing session into a different session.

Trace output is a **view, not a record**. It goes to the user inline; it is not written to the event log or any file. The durable record of a session is whatever that client already persists (for the skill: the Step 6 session summary — see [[GAPS]] "session-level events for the calibrator").

## First instance — the retention-session skill

`review-config.json` gains `trace`: `"off"` (default) | `"brief"` | `"full"`. Also switchable for a single run by asking in chat ("trace on", "debug this run", "trace off").

| Level | What the user sees per backend call |
|-------|-----------------------------------|
| `off` | nothing — the skill just uses results (today's behaviour) |
| `brief` | one line: the resolved command + a one-line digest of the result, tagged with the step that made the call |
| `full` | the exact command, then its complete raw stdout verbatim in a fenced block, before the skill acts on it; non-zero exits shown with status and stderr |

Under `brief` or `full`, the grade handoff (Step 5) also shows the mapping it used: each queue position → card prompt → rating → the `retention grade` line emitted. This is the step most worth tracing — the queue renumbers on every write, and trace makes the position→card binding auditable.

## Not in scope here

**Tag-level tracing inside the CLI** — which of mastery / graph / scheduler / session a command touched, with intermediate values (a card's Brightness, the THRESHOLD compare, the eligibility check) — would need a `retention --trace` / verbose flag on the CLI itself. That is a CLI change and is **parked**. A client can only see command-level granularity: command in, output out. Trace mode surfaces exactly that and no more.

Structured/machine-readable trace output (JSON lines a tool could diff across runs) is also parked; the first cut is human-readable inline text.

## Open refinements (skill UX)

Raised 2026-09-11 working the retention-session skill:

**A standard "engine calls" section, not only a debug toggle.** `trace: "brief"` today reads as a debugging aid — turned on when something looks wrong. The stated want is a short, always-present section in the session (a footer, or a collapsible block) listing the `retention` calls that actually ran and a one-line digest of each — *not* to debug, but as **assurance the tool is really driving the session** and the questions aren't being freelanced. Same content as `brief`, different framing: a receipt. Open: whether this replaces `off` as the default, or is a fourth mode (`receipt`), and whether it belongs in the skill or should be a real `retention session --explain`.

**Per-card engine detail.** `show` gives prompt + answer/must-hits; `mastery` gives one brightness number. Neither shows *why* a card is where it is — its Brightness with the difficulty/stability behind it, the THRESHOLD compare, the eligibility check that put it in (or kept it out of) the queue. Surfacing that per card is exactly the tag-level tracing parked above — it needs `retention --trace` or a richer `show` on the CLI. Recording the want here so the skill isn't the place it gets bolted on.
