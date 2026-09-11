Scheduler CLI — **pure**. Talks only to the Scheduler Tag.

Does: print `Scheduler.due` for a named tree. The values map is passed in.
Does not: know dependencies, card types, or the time. Does not import Mastery or Graph. Does not write files. Does not use card ids as the way to talk.

The CLI module may load the corpus so it can print titles and prompts. It must not import the other two engines. It does not call Mastery to build the values map. Probes all-0 (all due) and all-1 (none due) are allowed in this module.

## Command

```
[pure]    scheduler [title]
[pure]    scheduler full [title]
```

Title argument as in [SESSION_CLI.md](./SESSION_CLI.md). First line restates the description in context, then the payload.

Default probe: every card 0 (all due). `full` means every card 1 (none due).

Print due cards by node title and prompt, not card ids. `none due` if the list is empty.

Piped output is plain text. Same color rules as Session CLI when stdout is a terminal (`NO_COLOR` / pipe → none).
