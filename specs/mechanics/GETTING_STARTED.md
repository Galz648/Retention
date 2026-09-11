Product invoke (this version, once the binary exists):

```
retention                           # TTY: options menu (Session / Trees / Status) until q
retention version
retention session
retention session "Biology II"      # TTY: Session queue for that tree
retention trees                     # TTY: Trees map; piped: print the list
retention mastery "Biology II"
retention graph "Biology II"
retention graph full "Biology II"
retention scheduler "Biology II"
retention queue "Biology II"
retention show 1 "Biology II"
retention grade 1 Good "Biology II" # asks before writing
retention capture "diffusion is net flow down a gradient"
retention inbox
retention gap 1 core-error "concentration gradient direction" "stated low->high" "Biology II"
retention gaps
```

Omit the title in an interactive terminal → prompt (grouped as in `trees`).

TTY `retention` / `retention session` take the alternate screen until `q`. Home is the options menu; **Session** is due cards, inspect, grade with consent. Piped `trees` is the nested map and returns. Where you are in a map is the TUI path (`●`), not a `tree` dump.

`mastery`, `graph`, and `scheduler` each talk to one engine. They do not compose the other two.

Developer stand-in until compile is wired — same arguments, still no environment variables:

```
bun src/cli/main.ts help
```

`grade`, `capture`, and `gap` are impure. They will ask. Say no → nothing is created.

Agent git process: [LIFECYCLE.md](./LIFECYCLE.md). Pre-commit runs typecheck + tests, including invariant properties — see [INVARIANTS.md](./INVARIANTS.md).
