### Boundaries

Personal, single user, no sync, no sharing, no mobile app. Local files, one event log, one person's study.

The **command-line program is the product surface** for this version. Inspect and review happen by typing `retention …`. The user does not set env vars, and does not open corpus or log files to use the system.

### This version — build

- Engine (mastery, graph, scheduler)
- Session
- Inbox capture (`inbox.captured` in the event log; `retention capture` / `retention inbox`)
- Terminal CLI as specified in [SESSION_CLI.md](./components/SESSION_CLI.md): labeled pure/impure commands, consent before writes, tree chosen on the command line
- Append-only event log
- One or more hand-authored (or imported) trees in `corpus/`, each with a track (university or curiosity)
- Session / trees picker can filter by track; still one tree per sitting
- Standalone `retention` binary via Bun compile

### This version — do not build

Forester, curation, calibrator, dormancy/retirement, any UI except this CLI, `--yes` / non-interactive writes, env-var configuration as the interface.

### Milestones

1. Spec the CLI contract (this version) — including pure/impure and consent.
2. Implement that contract (help, trees, tree, show, queue, grade-with-confirm). Remove user-facing env vars.
3. Ship `retention` as a Bun-compiled binary.
