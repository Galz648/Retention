# Components
Engine (mastery, graph, scheduler) - Pure logic, no I/O, pure functional components, each component is standalone and naive of other's existance.
Scheduler — **pure**. Decides what's due for review.

Mastery — pure. Tracks how well you know each card, and how that fades.

Graph — pure. Knows what depends on what, and what you're ready for.

Session — impure. Runs a review: composes the engine, reads the stores, records what happened.
Session CLI (frontend) — impure. Drives a session from the terminal.

Forester — model-driven, non-deterministic. Forester proposes nodes and edges from source material. Runs as an agent skill.

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
See [ingestion-process.md](../../ingestion-process.md) for details on ingestion pipeline architecture and flows.
