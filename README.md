<pre align="center">
██████╗ ███████╗████████╗███████╗███╗   ██╗
██╔══██╗██╔════╝╚══██╔══╝██╔════╝████╗  ██║
██████╔╝█████╗     ██║   █████╗  ██╔██╗ ██║
██╔══██╗██╔══╝     ██║   ██╔══╝  ██║╚██╗██║
██║  ██║███████╗   ██║   ███████╗██║ ╚████║
╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═══╝
████████╗██╗ ██████╗ ███╗   ██╗
╚══██╔══╝██║██╔═══██╗████╗  ██║
   ██║   ██║██║   ██║██╔██╗ ██║
   ██║   ██║██║   ██║██║╚██╗██║
   ██║   ██║╚██████╔╝██║ ╚████║
   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
</pre>

### [What ?](./specs/WHAT.md)

### [Want ?](./specs/WANT.md)

<details open>
<summary><span style="font-size: 1.8em; font-family: Georgia, 'Times New Roman', serif; font-style: italic;">Framing</span></summary>

### [Why ?](./specs/framing/WHY.md)

### [Who is this for ?](./specs/framing/WHO.md)

### [What already exists ?](./specs/framing/WHAT_ALREADY_EXISTS.md)

### [Framework](./specs/framing/FRAMEWORK.md)

</details>

<details open>
<summary><span style="font-size: 1.8em; font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;">MECHANICS — THE HOW</span></summary>

### [Scope](./specs/mechanics/SCOPE.md)

<details open>
<summary><strong><a href="./specs/mechanics/ARCHITECTURE.md">Architecture</a></strong></summary>

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

Session CLI talks to Inbox and Gap directly. Session composes the Engine. Isolated probes (`mastery`, `graph`, `scheduler`) talk to one Engine Tag each — they do not go through Session. Forester writes Corpus only; it never reads the event log. Track (university | curiosity) is a field on each tree in Corpus. Session CLI uses it to pick (track, then tree). Track is not an Engine box.

##### [Data Layer](./specs/mechanics/ARCHITECTURE.md#data-layer)

<details open>
<summary><a href="./specs/mechanics/components/ENGINE.md">Engine</a></summary>

* [Mastery](./specs/mechanics/components/MASTERY.md) · [Mastery CLI](./specs/mechanics/components/MASTERY_CLI.md)
* [Graph](./specs/mechanics/components/GRAPH.md) · [Graph CLI](./specs/mechanics/components/GRAPH_CLI.md)
* [Scheduler](./specs/mechanics/components/SCHEDULER.md) · [Scheduler CLI](./specs/mechanics/components/SCHEDULER_CLI.md)

</details>

* [Session](./specs/mechanics/components/SESSION.md)
* [Session CLI](./specs/mechanics/components/SESSION_CLI.md)
* [Inbox](./specs/mechanics/components/INBOX.md)
* [Gap signal](./specs/mechanics/components/GAP_SIGNAL.md)
* [Forester](./specs/mechanics/components/FORESTER.md)

</details>

### [Legend](./specs/mechanics/LEGEND.md)

### [Implementation plan](./specs/mechanics/IMPLEMENTATION_PLAN.md)

### [Key decisions](./specs/mechanics/KEY_DECISIONS.md)

### [Tradeoffs](./specs/mechanics/TRADEOFFS.md)

### [Getting started](./specs/mechanics/GETTING_STARTED.md)

### [Gaps/Questions](./specs/mechanics/GAPS.md)

</details>
