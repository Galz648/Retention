Still to spec: forester. Open question: rename "brightness" (candidates: strength, readiness — not "retention", that is now the program's name).

# Components
[Engine](./components/ENGINE.md) (mastery, graph, scheduler) - Pure logic, no I/O, pure functional components, each component is standalone and naive of other's existance.
[Scheduler](./components/SCHEDULER.md) — **pure**. Decides what's due for review.

[Mastery](./components/MASTERY.md) — pure. Tracks how well you know each card, and how that fades.

[Graph](./components/GRAPH.md) — pure. Knows what depends on what, and what you're ready for.

[Session](./components/SESSION.md) — impure. Runs a review: composes the engine, reads the stores, records what happened.
[Session CLI](./components/SESSION_CLI.md) (frontend) — the user surface for this version. Component is impure; **commands** are labeled `[pure]` / `[impure]`. Impure commands ask before any write. The person sees tree **titles**, not folder names. Ships as a Bun-compiled binary named `retention`.

[Forester](./components/FORESTER.md) — model-driven, non-deterministic. Forester proposes nodes and edges from source material. Runs as an agent skill.

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
