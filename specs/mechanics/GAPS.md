Resolved: TypeScript does not generate a binary; this version uses Bun compile. Environment-variable UX is rejected. User-facing language is titles + glossary, not folder names or card ids. The program is named **`retention`**.

## Experience this version must feel like

You only talk to `retention`. You never set hidden settings, and you never open data files to see a tree or a card.

**You can see every tree.** `retention trees` lists them by title. You pick a tree by that title (or a unique prefix), or the program lists titles and asks. Folder names are not how you refer to trees.

**Each time you run a command, you choose the tree.** Nothing is stuck from a previous run. `retention queue "Biology II — seed tree"` and then `retention queue` with a different title (or a picker) are both normal. One invocation, one tree.

**Nothing is written unless you say yes.** `grade` states what it will append (and that it will create the log if needed), then `Proceed? [y/N]`. Default is no. If the program cannot ask (piped input), it refuses rather than writing. `queue` / `trees` / `show` never create files.

Still parked, not this version: interactive one-card loop, capture, curation, `--yes`. Install location (binary in this repo vs your shell's command path) can wait until the commands exist.

## Goal to paste into `/goal`

```
Implement the retention command-line client so it matches specs/mechanics/components/SESSION_CLI.md and the experience in specs/mechanics/GAPS.md.

The program is named retention. All interaction goes through it: no environment variables, no opening corpus or log files, no folder names or card ids in what I see.

Experience to verify:
1. I can list every tree by title (retention trees) and inspect one tree's nodes/edges by title.
2. Each invocation chooses a tree by title or by an interactive picker. A run is not glued to one tree from startup.
3. queue is numbered (type, node title, prompt). show prints the answer or must-hits. grade asks Proceed? [y/N] before appending; default no; piped input refuses. queue on a missing log does not create the log.

Also: help labels every command [pure] or [impure]; Bun-compile a retention binary (bun src/cli/main.ts is only a developer stand-in with the same arguments). Do not build parked features (review loop, capture, curation, --yes).

Evidence: tests for listing, title resolution, numbered queue/show, consent (yes writes, no/non-interactive does not), and a real run of retention help / trees / queue against the imported corpus.
```
