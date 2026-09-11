Mastery CLI — **pure**. Talks only to the Mastery Tag.

Does: print Brightness per card for a named tree — node title, prompt, number 0–1.
Does not: pick cards, check prerequisites, decide due-ness, import Graph or Scheduler, write files, or create the event log.

The CLI module may load the corpus and the event log. It must not import the other two engines. Missing log = empty history; the file is not created.

## Command

```
[pure]    mastery [title]
```

Title argument as in [SESSION_CLI.md](./SESSION_CLI.md). First line restates the description in context, then one line per card: node title, prompt, Brightness as a number in `[0, 1]`. No card ids, no folder names.

Unreviewed cards still get a Brightness. Session CLI does not compute these numbers; this command (and Session.queue) does.

Piped output is plain text. Same color rules as Session CLI when stdout is a terminal (`NO_COLOR` / pipe → none).
