Product invoke (this version, once the binary exists):

```
retention help
retention trees
retention queue "Biology II"
retention show 1 "Biology II"
retention grade 1 Good "Biology II"    # asks before writing
```

Omit the title in an interactive terminal → select (grouped knowledge trees vs term decks).

`trees` is the short map. `tree` is the full node/edge view. Counts live there, not on the list.

Developer stand-in until compile is wired — same arguments, still no environment variables:

```
bun src/cli/main.ts help
```

`grade` is the only impure command. It will ask. Say no → nothing is created.
