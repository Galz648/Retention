Graph CLI — **pure**. Talks only to the Graph Tag.

Does: print `Graph.eligible` for a named tree. The snapshot is passed in.
Does not: know the time, know what's due, import Mastery or Scheduler, write files, or use card ids as the way to talk.

The CLI module may load the corpus. It must not import the other two engines. It does not call Mastery to build the snapshot.

## Command

```
[pure]    graph [title]
[pure]    graph full [title]
```

Title argument as in [SESSION_CLI.md](./SESSION_CLI.md). First line restates the description in context, then the payload.

Default probe: every node 0. `full` means every node 1.

Print:

- eligible node **titles**
- blocked nodes with the prerequisite **titles** still below THRESHOLD

No folder names. No node or card ids as the way to talk.

Piped output is plain text. Same color rules as Session CLI when stdout is a terminal (`NO_COLOR` / pipe → none).
