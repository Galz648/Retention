Forester specced as a programmatic pipeline: [FORESTER.md](./components/FORESTER.md). Open question: rename "brightness" (candidates: strength, readiness — not "retention", that is now the program's name).

# Components
[Engine](./components/ENGINE.md) (mastery, graph, scheduler) - Pure logic, no I/O, pure functional components, each component is standalone and naive of other's existance.
[Scheduler](./components/SCHEDULER.md) — **pure**. Decides what's due for review.

[Mastery](./components/MASTERY.md) — pure. Tracks how well you know each card, and how that fades.

[Graph](./components/GRAPH.md) — pure. Knows what depends on what, and what you're ready for.

[Session](./components/SESSION.md) — impure. Runs a review: composes the engine, reads the stores, records what happened.
[Inbox](./components/INBOX.md) — impure. Appends raw captured notes (`inbox.captured`); lists pending. Does not compose the engine. Consent is in Session CLI.
[Gap signal](./components/GAP_SIGNAL.md) — impure. Appends `gap.observed` (missed sub-concept on a derivation); lists pending. Does not compose the engine. Consent is in Session CLI.
[Session CLI](./components/SESSION_CLI.md) (frontend) — the user surface for this version. TTY `session` is a fullscreen TUI; one-shot commands are CLI. Component is impure; **commands** are labeled `[pure]` / `[impure]`. Impure commands ask before any write. The person sees tree **titles**, not folder names. Interactive pick is **track, then tree**; a title argument skips track. Ships as a Bun-compiled binary named `retention`. Isolated probes: [Mastery CLI](./components/MASTERY_CLI.md), [Graph CLI](./components/GRAPH_CLI.md), [Scheduler CLI](./components/SCHEDULER_CLI.md) — each talks to one engine Tag.

[Forester](./components/FORESTER.md) — a programmatic pipeline with model-assisted stages. Turns course materials (learning outcomes, textbook, assignments, past exams) into a corpus tree anchored to the course's goals. Proposes; nothing lands without approval; never reads the event log.

```
     Session CLI                           Forester
          │                                    │
          ├────► Inbox                         │
          ├────► Gap                           │
          │                                    │
          │     ┌──────────────────────────┐     │
          └────►│         Session          │     │
                │  ┌─────────────────────┐ │     │
                │  │       Engine        │ │     │
                │  │  Mastery    Graph   │ │     │
                │  │      Scheduler      │ │     │
                │  └─────────────────────┘ │     │
                └────────────┬─────────────┘     │
                             │                    │
                        event logs                │
                          Corpus ◄───────────────┘
```

Session CLI talks to Inbox and Gap directly; they never import the engine. Isolated `mastery` / `graph` / `scheduler` commands talk to one Engine Tag each — they do not go through Session. Track (university | curiosity) lives on each tree in Corpus. The picker uses it. It is not a component that talks to Mastery, Graph, or Scheduler.

### Data Layer
* event logs — store. Append-only history of every review you've done. The only source of truth.
* Corpus — store. holds knowledge trees, one directory per subject -  The node and edge files themselves. Each tree has a **track** (university or curiosity), orthogonal to kind.

# Processes
See [ingestion-process.md](./ingestion-process.md) for details on ingestion pipeline architecture and flows.
