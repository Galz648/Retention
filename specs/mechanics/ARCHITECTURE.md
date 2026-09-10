Forester specced as a programmatic pipeline: [FORESTER.md](./components/FORESTER.md). Open question: rename "brightness" (candidates: strength, readiness — not "retention", that is now the program's name).

# Components
[Engine](./components/ENGINE.md) (mastery, graph, scheduler) - Pure logic, no I/O, pure functional components, each component is standalone and naive of other's existance.
[Scheduler](./components/SCHEDULER.md) — **pure**. Decides what's due for review.

[Mastery](./components/MASTERY.md) — pure. Tracks how well you know each card, and how that fades.

[Graph](./components/GRAPH.md) — pure. Knows what depends on what, and what you're ready for.

[Session](./components/SESSION.md) — impure. Runs a review: composes the engine, reads the stores, records what happened.
[Session CLI](./components/SESSION_CLI.md) (frontend) — the user surface for this version. TTY `session` is a fullscreen TUI; one-shot commands are CLI. Component is impure; **commands** are labeled `[pure]` / `[impure]`. Impure commands ask before any write. The person sees tree **titles**, not folder names. Ships as a Bun-compiled binary named `retention`.

[Forester](./components/FORESTER.md) — a programmatic pipeline with model-assisted stages. Turns course materials (learning outcomes, textbook, assignments, past exams) into a corpus tree anchored to the course's goals. Proposes; nothing lands without approval; never reads the event log.

```
     Session CLI                           Forester
          │                                    │
          │     ┌──────────────────────────┐   │
          └────►│         Session          │   │
                │  ┌─────────────────────┐ │   │
                │  │       Engine        │ │   │
                │  │  Mastery    Graph   │ │   │
                │  │      Scheduler      │ │   │
                │  └─────────────────────┘ │   │
                └────────────┬─────────────┘   │
                             │                 │
                        event logs             │
                          Corpus ◄─────────────┘
```

### Data Layer
* event logs — store. Append-only history of every review you've done. The only source of truth.
* Corpus — store. holds knowledge trees, one directory per subject -  The node and edge files themselves.

# Processes
See [ingestion-process.md](./ingestion-process.md) for details on ingestion pipeline architecture and flows.
